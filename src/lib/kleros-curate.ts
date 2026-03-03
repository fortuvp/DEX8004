import { GraphQLClient, gql } from "graphql-request";
import type { AgentSubgraphNetwork } from "@/lib/agent-networks";
import { getAgentNetworkFromChainId, parseChainId } from "@/lib/block-explorer";
import {
  getCurateMode,
  getCurateRegistryAddress,
  getCurateSubgraphUrl,
  getGoldskyApiKey,
  type CurateMode,
} from "@/lib/curate-config";

export const KLEROS_CURATE_SEPOLIA_CHAIN_ID = 11155111;

function getCurateRegistryUrl(registryAddress: string) {
  // Kleros Curate UI expects checksummed address in the URL (but any-case works in practice).
  return `https://curate.kleros.io/tcr/${KLEROS_CURATE_SEPOLIA_CHAIN_ID}/${registryAddress}`;
}

function getCurateItemUrl(registryAddress: string, itemID: string) {
  return `${getCurateRegistryUrl(registryAddress)}/${encodeURIComponent(itemID)}`;
}

export type GtcrItemStatus =
  | "Absent"
  | "Registered"
  | "RegistrationRequested"
  | "ClearingRequested"
  | string;

export type PgtcrItemStatus = "Absent" | "Submitted" | "Reincluded" | "Disputed" | string;

export type CurateItemStatus = GtcrItemStatus | PgtcrItemStatus;

export interface CurateLookupResult {
  found: boolean;
  mode: CurateMode;
  status?: CurateItemStatus;
  itemID?: string;
  disputed?: boolean;

  // PGTCR-specific fields used to compute "accepted" off-chain.
  includedAt?: number; // seconds
  submissionPeriod?: number; // seconds
  reinclusionPeriod?: number; // seconds

  curateRegistryUrl: string;
  curateItemUrl?: string;
}

// -----------------
// GTCR (Envio) query
// -----------------

const GTCR_LITEMS_BY_REGISTRY_AND_KEY0 = gql`
  query LItemsByRegistryAndKey0($registry: String!, $key0: String!) {
    LItem(
      where: { registryAddress: { _eq: $registry }, key0: { _eq: $key0 } }
      order_by: { latestRequestSubmissionTime: desc }
    ) {
      id
      itemID
      status
      disputed
      latestRequestSubmissionTime
      latestRequestResolutionTime
      key0
      props {
        label
        value
        isIdentifier
      }
    }
  }
`;

// -------------------
// PGTCR (Goldsky) query
// -------------------

const PGTCR_ITEMS_BY_REGISTRY_AND_KEY0 = gql`
  query ItemsByRegistryAndKey0($registry: Bytes!, $key0: String!) {
    items(
      where: { registryAddress: $registry, metadata_: { key0: $key0 } }
      orderBy: includedAt
      orderDirection: desc
    ) {
      id
      itemID
      status
      includedAt
      registry {
        id
        submissionPeriod
        reinclusionPeriod
      }
      metadata {
        key0
        key2
      }
    }
  }
`;

type CurateProp = {
  label?: string | null;
  value?: string | null;
  isIdentifier?: boolean | null;
};

function getNetworkFromCaip10Owner(value: string | null | undefined): AgentSubgraphNetwork | null {
  const chainId = parseChainId(value || "");
  if (!chainId) return null;
  return getAgentNetworkFromChainId(chainId);
}

function getNetworkFromGtcrProps(props: CurateProp[] | null | undefined): AgentSubgraphNetwork | null {
  if (!props?.length) return null;
  const key2 = props.find((prop) => prop.label?.trim().toLowerCase() === "key2")?.value?.trim();
  if (!key2) return null;
  return getNetworkFromCaip10Owner(key2);
}

function matchesExpectedNetwork(
  expectedNetwork: AgentSubgraphNetwork | undefined,
  resolvedNetwork: AgentSubgraphNetwork | null
): boolean {
  if (!expectedNetwork) return true;
  return resolvedNetwork === expectedNetwork;
}

function makeGraphqlClient(mode: CurateMode): GraphQLClient {
  const url = getCurateSubgraphUrl(mode);

  // Goldsky public endpoints often accept an API key header.
  if (mode === "pgtcr") {
    const apiKey = getGoldskyApiKey();
    return new GraphQLClient(url, apiKey ? { headers: { "x-api-key": apiKey } } : undefined);
  }

  return new GraphQLClient(url);
}

export function isCurateItemAccepted(lookup: CurateLookupResult, nowSec: number): boolean {
  if (!lookup.found || !lookup.status) return false;

  if (lookup.mode === "gtcr") {
    return lookup.status === "Registered";
  }

  // PGTCR:
  // An item displays as "accepted" when its status is Submitted or Reincluded
  // AND includedAt + period < now, where period depends on the status.
  const status = lookup.status;
  const includedAt = lookup.includedAt;
  if (!includedAt) return false;

  if (status === "Submitted") {
    const p = lookup.submissionPeriod;
    if (!p && p !== 0) return false;
    return includedAt + p < nowSec;
  }

  if (status === "Reincluded") {
    const p = lookup.reinclusionPeriod;
    if (!p && p !== 0) return false;
    return includedAt + p < nowSec;
  }

  return false;
}

export async function lookupCurateItemByAgentId(
  agentId: string | number,
  options?: { network?: AgentSubgraphNetwork }
): Promise<CurateLookupResult> {
  const key0 = String(agentId);
  const expectedNetwork = options?.network;
  const mode = getCurateMode();
  const registryAddress = getCurateRegistryAddress(mode);

  const client = makeGraphqlClient(mode);

  const curateRegistryUrl = getCurateRegistryUrl(registryAddress);

  if (mode === "gtcr") {
    const res = await client.request<{
      LItem: Array<{
        itemID: string;
        status: GtcrItemStatus;
        disputed?: boolean;
        props?: CurateProp[];
      }>;
    }>(GTCR_LITEMS_BY_REGISTRY_AND_KEY0, {
      registry: registryAddress.toLowerCase(),
      key0,
    });

    const first = (res?.LItem || []).find((item) =>
      matchesExpectedNetwork(expectedNetwork, getNetworkFromGtcrProps(item.props))
    );
    if (!first) return { found: false, mode, curateRegistryUrl };

    return {
      found: true,
      mode,
      status: first.status,
      itemID: first.itemID,
      disputed: first.disputed,
      curateRegistryUrl,
      curateItemUrl: getCurateItemUrl(registryAddress, first.itemID),
    };
  }

  // mode === "pgtcr"
  const res = await client.request<{
    items: Array<{
      itemID: string;
      status: PgtcrItemStatus;
      includedAt: string;
      metadata?: { key0?: string; key2?: string | null } | null;
      registry: { submissionPeriod: string; reinclusionPeriod: string };
    }>;
  }>(PGTCR_ITEMS_BY_REGISTRY_AND_KEY0, {
    registry: registryAddress.toLowerCase(),
    key0,
  });

  const fallbackFromAgentId = getNetworkFromCaip10Owner(key0);
  const first = (res?.items || []).find((item) => {
    if (!expectedNetwork) return true;
    const metadataNetwork = getNetworkFromCaip10Owner(item.metadata?.key2 || "");
    if (metadataNetwork) return metadataNetwork === expectedNetwork;
    if (fallbackFromAgentId) return fallbackFromAgentId === expectedNetwork;
    return false;
  });
  if (!first) return { found: false, mode, curateRegistryUrl };

  const includedAt = Number(first.includedAt);
  const submissionPeriod = Number(first.registry?.submissionPeriod);
  const reinclusionPeriod = Number(first.registry?.reinclusionPeriod);

  return {
    found: true,
    mode,
    status: first.status,
    itemID: first.itemID,
    disputed: first.status === "Disputed",
    includedAt: Number.isFinite(includedAt) ? includedAt : undefined,
    submissionPeriod: Number.isFinite(submissionPeriod) ? submissionPeriod : undefined,
    reinclusionPeriod: Number.isFinite(reinclusionPeriod) ? reinclusionPeriod : undefined,
    curateRegistryUrl,
    curateItemUrl: getCurateItemUrl(registryAddress, first.itemID),
  };
}

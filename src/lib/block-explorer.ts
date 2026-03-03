import {
  AGENT_NETWORK_CHAIN_IDS,
  type AgentSubgraphNetwork,
} from "@/lib/agent-networks";

const EXPLORER_BASE_BY_CHAIN_ID: Record<number, string> = {
  1: "https://etherscan.io",
  56: "https://bscscan.com",
  137: "https://polygonscan.com",
  8453: "https://basescan.org",
  11155111: "https://sepolia.etherscan.io",
};

const CHAIN_ID_TO_AGENT_NETWORK = Object.fromEntries(
  Object.entries(AGENT_NETWORK_CHAIN_IDS).map(([network, chainId]) => [
    chainId,
    network as AgentSubgraphNetwork,
  ])
) as Record<number, AgentSubgraphNetwork>;

export function parseChainId(value: string | number | null | undefined): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return null;

  const trimmed = value.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith("eip155:")) {
    const parts = trimmed.split(":");
    const parsed = Number.parseInt(parts[1] || parts[2] || "", 10);
    return Number.isNaN(parsed) ? null : parsed;
  }

  const parsed = Number.parseInt(trimmed, 10);
  return Number.isNaN(parsed) ? null : parsed;
}

export function getExplorerBaseUrlByChainId(
  chainIdLike: string | number | null | undefined
): string | null {
  const chainId = parseChainId(chainIdLike);
  if (!chainId) return null;
  return EXPLORER_BASE_BY_CHAIN_ID[chainId] || null;
}

export function getExplorerBaseUrlByNetwork(
  network: AgentSubgraphNetwork
): string | null {
  return EXPLORER_BASE_BY_CHAIN_ID[AGENT_NETWORK_CHAIN_IDS[network]] || null;
}

export function getAddressExplorerUrl(
  address: string,
  chainIdLike: string | number | null | undefined
): string | null {
  const baseUrl = getExplorerBaseUrlByChainId(chainIdLike);
  if (!baseUrl) return null;
  return `${baseUrl}/address/${address}`;
}

export function getTxExplorerUrl(
  txHash: string,
  chainIdLike: string | number | null | undefined
): string | null {
  const baseUrl = getExplorerBaseUrlByChainId(chainIdLike);
  if (!baseUrl) return null;
  return `${baseUrl}/tx/${txHash}`;
}

export function getAddressExplorerUrlForNetwork(
  address: string,
  network: AgentSubgraphNetwork
): string | null {
  const baseUrl = getExplorerBaseUrlByNetwork(network);
  if (!baseUrl) return null;
  return `${baseUrl}/address/${address}`;
}

export function getTxExplorerUrlForNetwork(
  txHash: string,
  network: AgentSubgraphNetwork
): string | null {
  const baseUrl = getExplorerBaseUrlByNetwork(network);
  if (!baseUrl) return null;
  return `${baseUrl}/tx/${txHash}`;
}

export function getAgentNetworkFromAgentId(agentId: string): AgentSubgraphNetwork | null {
  const trimmed = agentId.trim();
  if (!trimmed.startsWith("eip155:")) return null;

  return getAgentNetworkFromChainId(trimmed);
}

export function getAgentNetworkFromChainId(
  chainIdLike: string | number | null | undefined
): AgentSubgraphNetwork | null {
  const chainId = parseChainId(chainIdLike);
  if (!chainId) return null;
  return CHAIN_ID_TO_AGENT_NETWORK[chainId] || null;
}

export function truncateHash(hash: string): string {
  if (!hash) return "-";
  return `${hash.slice(0, 6)}...${hash.slice(-4)}`;
}

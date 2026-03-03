import type { AgentSubgraphNetwork } from "@/lib/agent-networks";
import { AGENT_NETWORK_CHAIN_IDS, isAgentSubgraphNetwork } from "@/lib/agent-networks";
import { getAgentNetworkFromAgentId, getAgentNetworkFromChainId, parseChainId } from "@/lib/block-explorer";
import { parseAgentIdFromQuestionText } from "@/lib/reality/abuse-flags";

function parseNetworkLike(value: string | null | undefined): AgentSubgraphNetwork | null {
  const trimmed = value?.trim().toLowerCase();
  if (!trimmed) return null;
  if (isAgentSubgraphNetwork(trimmed)) return trimmed;
  if (trimmed === "mainnet" || trimmed === "eth" || trimmed === "ethereum mainnet") return "ethereum";

  const chainId = parseChainId(trimmed);
  if (chainId) return getAgentNetworkFromChainId(chainId);
  return null;
}

export function parseAgentNetworkFromQuestionText(question: string): AgentSubgraphNetwork | null {
  const explicitPatterns = [
    /AgentNetwork:\s*([^\n\r]+)/i,
    /Network:\s*([^\n\r]+)/i,
    /AgentChainId:\s*([^\n\r]+)/i,
    /ChainId:\s*([^\n\r]+)/i,
  ];

  for (const pattern of explicitPatterns) {
    const match = question.match(pattern);
    const candidate = match?.[1]?.trim();
    const parsed = parseNetworkLike(candidate);
    if (parsed) return parsed;
  }

  const parsedAgentId = parseAgentIdFromQuestionText(question);
  if (parsedAgentId) {
    const fromAgentId = getAgentNetworkFromAgentId(parsedAgentId);
    if (fromAgentId) return fromAgentId;
  }

  return null;
}

export function doesQuestionMatchAgent(
  question: string,
  agentId: string,
  network: AgentSubgraphNetwork
): boolean {
  const parsedAgentId = parseAgentIdFromQuestionText(question);
  if (!parsedAgentId) return false;

  const parsedLower = parsedAgentId.toLowerCase();
  const parsedShort = parsedLower.split(":").pop() || parsedLower;
  const candidate = agentId.toLowerCase();
  const candidateShort = candidate.split(":").pop() || candidate;

  const idMatches =
    parsedLower === candidate ||
    parsedLower === candidateShort ||
    parsedShort === candidate ||
    parsedShort === candidateShort;
  if (!idMatches) return false;

  const questionNetwork = parseAgentNetworkFromQuestionText(question);
  if (questionNetwork) return questionNetwork === network;

  // Legacy questions may not include explicit chain context. Restrict to Sepolia
  // to avoid cross-chain mismatches for identical short agent IDs.
  return network === "sepolia";
}

export function getAgentChainDescriptor(network: AgentSubgraphNetwork): string {
  return `eip155:${AGENT_NETWORK_CHAIN_IDS[network]}`;
}

export const AGENT_SUBGRAPH_NETWORKS = [
  "sepolia",
  "ethereum",
  "base",
  "bsc",
  "polygon",
] as const;

export type AgentSubgraphNetwork = (typeof AGENT_SUBGRAPH_NETWORKS)[number];

export const AGENT_SUBGRAPH_LABELS: Record<AgentSubgraphNetwork, string> = {
  sepolia: "Sepolia",
  ethereum: "Ethereum",
  base: "Base",
  bsc: "BSC",
  polygon: "Polygon",
};

export const AGENT_SUBGRAPH_ENV_KEYS: Record<AgentSubgraphNetwork, string> = {
  sepolia: "SEPOLIA_SUBGRAPH_KEY",
  ethereum: "ETHEREUM_MAINNET_SUBGRAPH_KEY",
  base: "BASE_MAINNET_SUBGRAPH_KEY",
  bsc: "BSC_MAINNET_SUBGRAPH_KEY",
  polygon: "POLYGON_MAINNET_SUBGRAPH_KEY",
};

export const AGENT_NETWORK_CHAIN_IDS: Record<AgentSubgraphNetwork, number> = {
  sepolia: 11155111,
  ethereum: 1,
  base: 8453,
  bsc: 56,
  polygon: 137,
};

const CHAIN_ID_LABELS: Record<number, string> = {
  1: "Ethereum",
  56: "BSC",
  137: "Polygon",
  8453: "Base",
  11155111: "Sepolia",
};

export function isAgentSubgraphNetwork(value: string | null | undefined): value is AgentSubgraphNetwork {
  return !!value && AGENT_SUBGRAPH_NETWORKS.includes(value as AgentSubgraphNetwork);
}

export function getAgentSubgraphLabel(network: AgentSubgraphNetwork): string {
  return AGENT_SUBGRAPH_LABELS[network];
}

function parseChainId(chainId: string): number | null {
  const trimmed = chainId.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith("eip155:")) {
    const parts = trimmed.split(":");
    const parsed = Number.parseInt(parts[1] || parts[2] || "", 10);
    return Number.isNaN(parsed) ? null : parsed;
  }

  const decimal = Number.parseInt(trimmed, 10);
  if (!Number.isNaN(decimal)) return decimal;

  return null;
}

export function getAgentChainLabel(
  chainId: string | null | undefined,
  fallbackNetwork: AgentSubgraphNetwork = "sepolia"
): string {
  if (chainId) {
    const numericChainId = parseChainId(chainId);
    if (numericChainId && CHAIN_ID_LABELS[numericChainId]) {
      return CHAIN_ID_LABELS[numericChainId];
    }
  }
  return getAgentSubgraphLabel(fallbackNetwork);
}

import type { Agent } from "@/types/agent";
import { AGENT_SUBGRAPH_NETWORKS, type AgentSubgraphNetwork } from "@/lib/agent-networks";

export async function fetchAgentsAcrossNetworks(options?: {
  networks?: AgentSubgraphNetwork[];
  pageSize?: number;
  sort?: string;
  query?: string;
}) {
  const networks = options?.networks?.length ? options.networks : AGENT_SUBGRAPH_NETWORKS;
  const pageSize = options?.pageSize || 200;
  const sort = options?.sort || "createdAt:desc";
  const query = options?.query?.trim() || "";

  const groups = await Promise.all(
    networks.map(async (network) => {
      const params = new URLSearchParams({
        page: "1",
        pageSize: String(pageSize),
        sort,
        network,
      });
      if (query) params.set("q", query);

      const res = await fetch(`/api/agents?${params.toString()}`, { cache: "no-store" });
      if (!res.ok) return [] as Agent[];
      const json = await res.json();
      return (json?.success ? (json.items as Agent[]) : []) || [];
    })
  );

  const unique = new Map<string, Agent>();
  for (const group of groups) {
    for (const agent of group) {
      unique.set(`${agent.id}:${agent.chainId}`, agent);
    }
  }

  return Array.from(unique.values());
}


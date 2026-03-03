import { NextResponse } from "next/server";
import { getAgentByAgentId } from "@/lib/subgraph.handler";
import {
  AGENT_NETWORK_CHAIN_IDS,
  isAgentSubgraphNetwork,
  type AgentSubgraphNetwork,
} from "@/lib/agent-networks";

function buildAgentIdCandidates(agentIdParam: string, network: AgentSubgraphNetwork): string[] {
  const trimmed = agentIdParam.trim();
  if (!trimmed) return [];

  const candidates = new Set<string>();
  candidates.add(trimmed);

  if (trimmed.startsWith("eip155:")) {
    const parts = trimmed.split(":");
    if (parts.length >= 3 && parts[2]) candidates.add(parts[2]);
  } else if (/^\d+$/.test(trimmed)) {
    candidates.add(`eip155:${AGENT_NETWORK_CHAIN_IDS[network]}:${trimmed}`);
  }

  return Array.from(candidates);
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const agentIdParam = url.searchParams.get("agentId")?.trim();
    const rawNetwork = url.searchParams.get("network");

    let network: AgentSubgraphNetwork = "sepolia";
    if (rawNetwork) {
      if (!isAgentSubgraphNetwork(rawNetwork)) {
        return NextResponse.json(
          { success: false, error: `Invalid network '${rawNetwork}'` },
          { status: 400 }
        );
      }
      network = rawNetwork;
    }

    if (!agentIdParam) {
      return NextResponse.json(
        { success: false, error: "Missing agentId" },
        { status: 400 }
      );
    }

    const candidates = buildAgentIdCandidates(agentIdParam, network);

    for (const candidate of candidates) {
      const agent = await getAgentByAgentId(candidate, network);
      if (agent) {
        return NextResponse.json({
          success: true,
          found: true,
          network,
          agentId: candidate,
          item: agent,
        });
      }
    }

    return NextResponse.json({
      success: true,
      found: false,
      network,
      agentId: agentIdParam,
      item: null,
      checked: candidates,
    });
  } catch (e) {
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 }
    );
  }
}

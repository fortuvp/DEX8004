import { NextRequest, NextResponse } from "next/server";
import { getDashboardStats } from "@/lib/stats.server";
import { AGENT_SUBGRAPH_NETWORKS, isAgentSubgraphNetwork, type AgentSubgraphNetwork } from "@/lib/agent-networks";

export async function GET(request: NextRequest) {
  const sampleSizeParam = request.nextUrl.searchParams.get("sampleSize");
  const networksParam = request.nextUrl.searchParams.get("networks");
  const networkParam = request.nextUrl.searchParams.get("network");
  const sampleSize = sampleSizeParam ? Number.parseInt(sampleSizeParam, 10) : 12000;
  const boundedSampleSize = Number.isNaN(sampleSize)
    ? 12000
    : Math.max(500, Math.min(50000, sampleSize));

  const requestedNetworks = (networksParam || networkParam || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  const invalid = requestedNetworks.find((value) => !isAgentSubgraphNetwork(value));
  if (invalid) {
    return NextResponse.json(
      {
        success: false,
        error: `Invalid network '${invalid}'. Allowed: ${AGENT_SUBGRAPH_NETWORKS.join(", ")}`,
      },
      { status: 400 }
    );
  }

  const networks = (requestedNetworks.length ? requestedNetworks : AGENT_SUBGRAPH_NETWORKS) as AgentSubgraphNetwork[];

  try {
    const data = await getDashboardStats({ sampleSize: boundedSampleSize, networks });
    return NextResponse.json({ success: true, ...data });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to compute dashboard stats",
      },
      { status: 500 }
    );
  }
}

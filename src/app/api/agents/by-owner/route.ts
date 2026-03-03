import { NextRequest, NextResponse } from "next/server";
import { getAgentsByOwner } from "@/lib/subgraph.handler";
import { isAgentSubgraphNetwork, type AgentSubgraphNetwork } from "@/lib/agent-networks";

export async function GET(request: NextRequest) {
  const owner = request.nextUrl.searchParams.get("owner")?.trim();
  const protocol = request.nextUrl.searchParams.get("protocol") || undefined;
  const first = Number.parseInt(request.nextUrl.searchParams.get("first") || "50", 10);
  const skip = Number.parseInt(request.nextUrl.searchParams.get("skip") || "0", 10);
  const rawNetwork = request.nextUrl.searchParams.get("network");

  let network: AgentSubgraphNetwork = "sepolia";
  if (rawNetwork) {
    if (!isAgentSubgraphNetwork(rawNetwork)) {
      return NextResponse.json(
        { success: false, error: `Invalid network '${rawNetwork}'`, items: [] },
        { status: 400 }
      );
    }
    network = rawNetwork;
  }

  if (!owner) {
    return NextResponse.json(
      { success: false, error: "Missing owner address", items: [] },
      { status: 400 }
    );
  }

  try {
    const items = await getAgentsByOwner({
      owner,
      first: Math.max(1, Math.min(200, first)),
      skip: Math.max(0, skip),
      protocol,
      network,
    });
    return NextResponse.json({ success: true, items, network });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to search by owner",
        items: [],
      },
      { status: 500 }
    );
  }
}

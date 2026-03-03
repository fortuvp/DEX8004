import { NextRequest, NextResponse } from "next/server";
import { getAgentWithFeedback } from "@/lib/subgraph.handler";
import { isAgentSubgraphNetwork, type AgentSubgraphNetwork } from "@/lib/agent-networks";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const { id: rawId } = await params;
    const id = decodeURIComponent(rawId);
    const rawNetwork = request.nextUrl.searchParams.get("network");

    let network: AgentSubgraphNetwork = "sepolia";
    if (rawNetwork) {
        if (!isAgentSubgraphNetwork(rawNetwork)) {
            return NextResponse.json({ success: false, error: `Invalid network '${rawNetwork}'` }, { status: 400 });
        }
        network = rawNetwork;
    }

    try {
        const agent = await getAgentWithFeedback(id, 10, network);

        if (!agent) {
            return NextResponse.json({ success: false, error: "Agent not found" }, { status: 404 });
        }

        return NextResponse.json({ success: true, agent, network });
    } catch (error) {
        console.error("[Agent Detail API] Error:", error);
        return NextResponse.json(
            { success: false, error: error instanceof Error ? error.message : "Unknown error" },
            { status: 500 }
        );
    }
}

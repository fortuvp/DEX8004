import { NextRequest, NextResponse } from "next/server";
import { getAgents, searchAgents, getAgentByAgentId, OrderBy, OrderDirection } from "@/lib/subgraph.handler";
import {
    AGENT_NETWORK_CHAIN_IDS,
    isAgentSubgraphNetwork,
    type AgentSubgraphNetwork,
} from "@/lib/agent-networks";

function buildAgentIdCandidates(query: string, network: AgentSubgraphNetwork): string[] {
    const trimmed = query.trim();
    if (!trimmed) return [];

    const candidates = new Set<string>();
    candidates.add(trimmed);

    if (trimmed.startsWith("eip155:")) {
        const parts = trimmed.split(":");
        if (parts.length >= 3 && parts[2]) candidates.add(parts[2]);
    }

    if (/^\d+$/.test(trimmed)) {
        candidates.add(`eip155:${AGENT_NETWORK_CHAIN_IDS[network]}:${trimmed}`);
    }

    return Array.from(candidates);
}

function matchesAgentQuery(
    agent: {
        id: string;
        agentId: string;
        owner: string;
        agentURI: string | null;
        registrationFile: { name: string | null; description: string | null } | null;
    },
    query: string
) {
    const q = query.trim().toLowerCase();
    if (!q) return false;

    return (
        agent.id.toLowerCase().includes(q) ||
        agent.agentId.toLowerCase().includes(q) ||
        agent.owner.toLowerCase().includes(q) ||
        (agent.agentURI || "").toLowerCase().includes(q) ||
        (agent.registrationFile?.name || "").toLowerCase().includes(q) ||
        (agent.registrationFile?.description || "").toLowerCase().includes(q)
    );
}

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get("page") || "1", 10);
    const pageSize = parseInt(searchParams.get("pageSize") || "12", 10);
    const query = searchParams.get("q") || undefined;
    const sort = searchParams.get("sort") || "createdAt:desc";
    const protocol = searchParams.get("protocol") || undefined;
    const rawNetwork = searchParams.get("network");
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

    const [orderBy, orderDirection] = sort.split(":") as [OrderBy, OrderDirection];
    const skip = (page - 1) * pageSize;

    try {
        if (query) {
            const [nameResults, directAgentResults, broadResults] = await Promise.all([
                searchAgents({ query, first: Math.max(pageSize * 5, 120), skip: 0, protocol, network }),
                Promise.all(
                    buildAgentIdCandidates(query, network).map(async (agentIdCandidate) => {
                        try {
                            return await getAgentByAgentId(agentIdCandidate, network);
                        } catch {
                            return null;
                        }
                    })
                ),
                getAgents({
                    first: 300,
                    skip: 0,
                    orderBy,
                    orderDirection,
                    protocol,
                    network,
                }),
            ]);

            const unique = new Map<string, (typeof nameResults)[number]>();
            for (const directAgent of directAgentResults) {
                if (directAgent?.id) unique.set(directAgent.id, directAgent);
            }
            for (const byName of nameResults) {
                if (!unique.has(byName.id)) unique.set(byName.id, byName);
            }
            for (const candidate of broadResults) {
                if (!matchesAgentQuery(candidate, query)) continue;
                if (!unique.has(candidate.id)) unique.set(candidate.id, candidate);
            }

            const merged = Array.from(unique.values());
            const results = merged.slice(skip, skip + pageSize);
            return NextResponse.json({
                success: true,
                items: results,
                page,
                pageSize,
                hasMore: merged.length > skip + pageSize,
                network,
            });
        }

        const agents = await getAgents({ first: pageSize, skip, orderBy, orderDirection, protocol, network });
        return NextResponse.json({
            success: true,
            items: agents,
            page,
            pageSize,
            hasMore: agents.length === pageSize,
            network,
        });
    } catch (error) {
        console.error("[Agents API] Error:", error);
        return NextResponse.json(
            { success: false, error: error instanceof Error ? error.message : "Unknown error", items: [] },
            { status: 500 }
        );
    }
}

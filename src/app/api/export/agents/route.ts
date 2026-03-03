import { NextRequest, NextResponse } from "next/server";
import { getAgents } from "@/lib/subgraph.handler";
import { getDisplayName } from "@/lib/format";
import {
  AGENT_SUBGRAPH_NETWORKS,
  isAgentSubgraphNetwork,
  type AgentSubgraphNetwork,
} from "@/lib/agent-networks";
import { computeAgentQualityScore } from "@/lib/quality-score";

function parseNetworks(input: string | null): AgentSubgraphNetwork[] {
  const list = (input || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  if (!list.length) return [...AGENT_SUBGRAPH_NETWORKS];
  const valid = list.filter((value): value is AgentSubgraphNetwork => isAgentSubgraphNetwork(value));
  return valid.length ? valid : [...AGENT_SUBGRAPH_NETWORKS];
}

function matchesQuery(
  row: {
    id: string;
    agentId: string;
    owner: string;
    agentURI: string | null;
    registrationFile: { name: string | null; description: string | null } | null;
  },
  query: string
) {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return (
    row.id.toLowerCase().includes(needle) ||
    row.agentId.toLowerCase().includes(needle) ||
    row.owner.toLowerCase().includes(needle) ||
    (row.agentURI || "").toLowerCase().includes(needle) ||
    (row.registrationFile?.name || "").toLowerCase().includes(needle) ||
    (row.registrationFile?.description || "").toLowerCase().includes(needle)
  );
}

function toCsv(rows: Array<Record<string, string | number | boolean>>) {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  const lines = [headers.join(",")];
  for (const row of rows) {
    lines.push(
      headers
        .map((key) => {
          const value = String(row[key] ?? "");
          return `"${value.replace(/"/g, '""')}"`;
        })
        .join(",")
    );
  }
  return lines.join("\n");
}

export async function GET(request: NextRequest) {
  const search = request.nextUrl.searchParams;
  const q = search.get("q") || "";
  const format = (search.get("format") || "csv").toLowerCase();
  const limitRaw = Number.parseInt(search.get("limit") || "500", 10);
  const limit = Number.isNaN(limitRaw) ? 500 : Math.min(Math.max(limitRaw, 1), 1200);
  const networks = parseNetworks(search.get("network"));

  try {
    const perNetwork = Math.max(100, Math.ceil(limit / Math.max(networks.length, 1)));
    const groups = await Promise.all(
      networks.map(async (network) => {
        const items = await getAgents({
          network,
          first: perNetwork,
          skip: 0,
          orderBy: "createdAt",
          orderDirection: "desc",
        });
        return items
          .filter((item) => matchesQuery(item, q))
          .map((item) => ({
            network,
            id: item.id,
            agentId: item.agentId,
            name: getDisplayName(item),
            owner: item.owner,
            chainId: item.chainId,
            quality: computeAgentQualityScore(item),
            totalFeedback: Number.parseInt(item.totalFeedback, 10) || 0,
            createdAt: item.createdAt,
            updatedAt: item.updatedAt,
            lastActivity: item.lastActivity,
            mcp: !!item.registrationFile?.mcpEndpoint,
            a2a: !!item.registrationFile?.a2aEndpoint,
            x402: !!item.registrationFile?.x402Support,
          }));
      })
    );

    const rows = groups.flat().slice(0, limit);

    if (format === "json") {
      return NextResponse.json({ success: true, count: rows.length, items: rows, networks, query: q || null });
    }

    const csv = toCsv(rows);
    return new NextResponse(csv, {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="agents-export-${Date.now()}.csv"`,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to export agents" },
      { status: 500 }
    );
  }
}


import { NextRequest, NextResponse } from "next/server";
import { getDashboardStats } from "@/lib/stats.server";
import { isAgentSubgraphNetwork, type AgentSubgraphNetwork } from "@/lib/agent-networks";

type Tab = "trending" | "topRated" | "mostReviewed" | "recentlyActive" | "qualityLeaders";

const DEFAULT_TAB: Tab = "trending";
const VALID_TABS = new Set<Tab>(["trending", "topRated", "mostReviewed", "recentlyActive", "qualityLeaders"]);

function toCsv(rows: Array<Record<string, string | number>>) {
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
  const rawTab = search.get("tab");
  const tab: Tab = rawTab && VALID_TABS.has(rawTab as Tab) ? (rawTab as Tab) : DEFAULT_TAB;
  const format = (search.get("format") || "csv").toLowerCase();
  const networkParam = search.get("network");
  const networks: AgentSubgraphNetwork[] | undefined = networkParam
    ? networkParam
        .split(",")
        .map((value) => value.trim())
        .filter((value): value is AgentSubgraphNetwork => isAgentSubgraphNetwork(value))
    : undefined;

  try {
    const stats = await getDashboardStats({ sampleSize: 2000, networks });
    const rows = stats.lists[tab].map((item, index) => ({
      rank: index + 1,
      network: item.network,
      id: item.id,
      agentId: item.agentId,
      name: item.name,
      owner: item.owner,
      chainId: item.chainId,
      quality: item.quality,
      totalFeedback: item.totalFeedback,
      score: Math.round(item.score),
    }));

    if (format === "json") {
      return NextResponse.json({
        success: true,
        tab,
        count: rows.length,
        generatedAt: stats.generatedAt,
        selectedNetworks: stats.selectedNetworks,
        items: rows,
      });
    }

    const csv = toCsv(rows);
    return new NextResponse(csv, {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="leaderboard-${tab}-${Date.now()}.csv"`,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to export leaderboard" },
      { status: 500 }
    );
  }
}


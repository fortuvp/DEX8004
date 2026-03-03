"use client";

import * as React from "react";
import Link from "next/link";
import { Trophy, Star, Flame, MessageSquare, Clock3, Medal, Loader2, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AGENT_SUBGRAPH_NETWORKS,
  type AgentSubgraphNetwork,
  getAgentSubgraphLabel,
} from "@/lib/agent-networks";

type RankedAgent = {
  id: string;
  agentId: string;
  name: string;
  network: AgentSubgraphNetwork;
  totalFeedback: number;
  quality: number;
  score: number;
  createdAt: number;
  lastActivity: number;
};

type LeaderboardTab = "topRated" | "mostReviewed" | "recentlyActive" | "trending" | "qualityLeaders";

type StatsResponse = {
  success: boolean;
  generatedAt: string;
  selectedNetworks: AgentSubgraphNetwork[];
  sampleSize: number;
  lists: {
    topRated: RankedAgent[];
    mostReviewed: RankedAgent[];
    recentlyActive: RankedAgent[];
    trending: RankedAgent[];
    qualityLeaders: RankedAgent[];
  };
};

const TABS: Array<{ id: LeaderboardTab; label: string; icon: React.ElementType }> = [
  { id: "trending", label: "Trending", icon: Flame },
  { id: "topRated", label: "Top rated", icon: Star },
  { id: "mostReviewed", label: "Most reviewed", icon: MessageSquare },
  { id: "recentlyActive", label: "Recently active", icon: Clock3 },
  { id: "qualityLeaders", label: "Quality leaders", icon: Medal },
];

export default function LeaderboardPage() {
  const [tab, setTab] = React.useState<LeaderboardTab>("trending");
  const [network, setNetwork] = React.useState<"all" | AgentSubgraphNetwork>("all");
  const [data, setData] = React.useState<StatsResponse | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const query = network === "all" ? "" : `?network=${encodeURIComponent(network)}`;
        const res = await fetch(`/api/stats${query}`, { cache: "no-store" });
        const json = (await res.json()) as StatsResponse;
        if (!cancelled && json.success) setData(json);
      } catch {
        if (!cancelled) setData(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [network]);

  const rows = React.useMemo(() => {
    const source = [...(data?.lists[tab] || [])];
    return source.sort((a, b) => b.score - a.score);
  }, [data, tab]);
  const exportHref = `/api/export/leaderboard?tab=${encodeURIComponent(tab)}${network === "all" ? "" : `&network=${encodeURIComponent(network)}`}`;

  return (
    <div className="container mx-auto max-w-6xl px-6 py-10">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="mb-2 flex items-center gap-3">
            <Trophy className="h-6 w-6 text-primary" />
            <h1 className="text-3xl font-bold tracking-tight">Leaderboards</h1>
          </div>
          <p className="text-muted-foreground">Rankings are browsable by chain subgraph and recomputed from indexed data.</p>
        </div>
        <Button asChild variant="outline">
          <a href={exportHref}>
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </a>
        </Button>
      </div>

      <div className="mb-5 flex flex-wrap items-center gap-2">
        <Button
          variant={network === "all" ? "default" : "outline"}
          size="sm"
          className="rounded-lg"
          onClick={() => setNetwork("all")}
        >
          All networks
        </Button>
        {AGENT_SUBGRAPH_NETWORKS.map((item) => (
          <Button
            key={item}
            variant={network === item ? "default" : "outline"}
            size="sm"
            className="rounded-lg"
            onClick={() => setNetwork(item)}
          >
            {getAgentSubgraphLabel(item)}
          </Button>
        ))}
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        {TABS.map((item) => {
          const Icon = item.icon;
          return (
            <Button
              key={item.id}
              variant={tab === item.id ? "default" : "outline"}
              onClick={() => setTab(item.id)}
              className="h-9 rounded-lg"
            >
              <Icon className="mr-1.5 h-4 w-4" />
              {item.label}
            </Button>
          );
        })}
      </div>

      {loading ? (
        <div className="flex h-32 items-center justify-center text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          Loading leaderboard...
        </div>
      ) : rows.length ? (
        <div className="overflow-hidden rounded-xl border border-border/50">
          {rows.map((row, index) => (
            <Link
              key={`${row.network}-${row.id}-${index}`}
              href={`/agents/${encodeURIComponent(row.id)}?network=${row.network}`}
              className="flex items-center justify-between border-b border-border/40 bg-card/40 px-4 py-3 last:border-b-0 hover:bg-muted/30"
            >
              <div className="min-w-0">
                <div className="font-medium">
                  #{index + 1} {row.name}
                </div>
                <div className="text-xs text-muted-foreground">{getAgentSubgraphLabel(row.network)}</div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs">
                  Reviews {row.totalFeedback}
                </Badge>
                <Badge variant="outline" className="text-xs">
                  Quality {row.quality}
                </Badge>
                <Badge variant="outline" className="text-xs">
                  Score {Math.round(row.score)}
                </Badge>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-border/50 p-8 text-center text-muted-foreground">
          No ranking data available for this network.
        </div>
      )}

      <div className="mt-3 text-xs text-muted-foreground">
        Sample size: {data?.sampleSize || 0} | Updated{" "}
        {data?.generatedAt ? new Date(data.generatedAt).toLocaleTimeString() : "-"}
      </div>
    </div>
  );
}

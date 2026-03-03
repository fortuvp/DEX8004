"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { BriefcaseBusiness, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { AGENT_SUBGRAPH_NETWORKS, type AgentSubgraphNetwork, getAgentSubgraphLabel } from "@/lib/agent-networks";
import type { Agent } from "@/types/agent";
import { computeAgentQualityScore } from "@/lib/quality-score";
import { getDisplayName, truncateAddress } from "@/lib/format";

export default function OwnerPortfolioPage() {
  const params = useParams();
  const address = String(params.address || "");
  const [loading, setLoading] = React.useState(true);
  const [items, setItems] = React.useState<Array<Agent & { network: AgentSubgraphNetwork }>>([]);

  React.useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const groups = await Promise.all(
          AGENT_SUBGRAPH_NETWORKS.map(async (network) => {
            const res = await fetch(
              `/api/agents/by-owner?owner=${encodeURIComponent(address)}&network=${encodeURIComponent(network)}&first=200`,
              { cache: "no-store" }
            );
            if (!res.ok) return [] as Array<Agent & { network: AgentSubgraphNetwork }>;
            const json = await res.json();
            const mapped = ((json?.items || []) as Agent[]).map((item) => ({ ...item, network }));
            return mapped;
          })
        );
        if (!cancelled) setItems(groups.flat());
      } catch {
        if (!cancelled) setItems([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    if (address) load();
    return () => {
      cancelled = true;
    };
  }, [address]);

  const avgQuality = items.length
    ? Math.round(items.reduce((sum, item) => sum + computeAgentQualityScore(item), 0) / items.length)
    : 0;
  const totalReviews = items.reduce((sum, item) => sum + (Number.parseInt(item.totalFeedback, 10) || 0), 0);
  const byNetwork = Array.from(
    items.reduce((map, item) => map.set(item.network, (map.get(item.network) || 0) + 1), new Map<AgentSubgraphNetwork, number>())
  );

  return (
    <div className="container mx-auto max-w-6xl px-6 py-10">
      <div className="mb-8">
        <div className="mb-2 flex items-center gap-3">
          <BriefcaseBusiness className="h-6 w-6 text-primary" />
          <h1 className="text-3xl font-bold tracking-tight">Owner Portfolio</h1>
        </div>
        <p className="text-muted-foreground font-mono">{truncateAddress(address)}</p>
      </div>

      {loading ? (
        <div className="flex h-32 items-center justify-center text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          Loading portfolio...
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <Metric label="Total agents" value={items.length} />
            <Metric label="Total reviews" value={totalReviews} />
            <Metric label="Average quality" value={`${avgQuality}/100`} />
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {byNetwork.map(([network, count]) => (
              <Badge key={network} variant="outline">
                {getAgentSubgraphLabel(network)}: {count}
              </Badge>
            ))}
          </div>

          <div className="mt-6 space-y-2">
            {items.map((item) => (
              <Link
                key={`${item.network}-${item.id}`}
                href={`/agents/${encodeURIComponent(item.id)}?network=${item.network}`}
                className="flex items-center justify-between rounded-xl border border-border/50 bg-card/40 px-4 py-3 hover:border-border"
              >
                <div>
                  <div className="font-medium">{getDisplayName(item)}</div>
                  <div className="text-xs text-muted-foreground">{getAgentSubgraphLabel(item.network)}</div>
                </div>
                <div className="text-sm text-muted-foreground">Quality {computeAgentQualityScore(item)}</div>
              </Link>
            ))}
            {!items.length ? (
              <div className="rounded-xl border border-border/50 p-8 text-center text-muted-foreground">
                No agents found for this owner on configured networks.
              </div>
            ) : null}
          </div>
        </>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-border/50 bg-card/40 p-4">
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
    </div>
  );
}


"use client";

import * as React from "react";
import Link from "next/link";
import { Star, Loader2 } from "lucide-react";
import { useAccount } from "wagmi";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { AgentWithDetails } from "@/types/agent";
import type { AgentSubgraphNetwork } from "@/lib/agent-networks";
import {
  buildSnapshot,
  diffSnapshot,
  listWatchlist,
  refreshWatchSnapshot,
  toggleWatchlist,
  type WatchlistItem,
} from "@/lib/watchlist";
import { getDisplayName } from "@/lib/format";
import { computeAgentQualityScore } from "@/lib/quality-score";

type Row = WatchlistItem & {
  agent: AgentWithDetails | null;
  changes: string[];
};

export default function WatchlistPage() {
  const [rows, setRows] = React.useState<Row[]>([]);
  const [loading, setLoading] = React.useState(true);
  const { address, isConnected } = useAccount();

  const load = React.useCallback(async () => {
    setLoading(true);
    const items = listWatchlist(address);
    const resolved = await Promise.all(
      items.map(async (item): Promise<Row> => {
        try {
          const res = await fetch(`/api/agents/${encodeURIComponent(item.id)}?network=${encodeURIComponent(item.network)}`, {
            cache: "no-store",
          });
          const json = await res.json();
          const agent = (json?.success ? (json.agent as AgentWithDetails) : null) || null;
          if (!agent) return { ...item, agent: null, changes: ["Agent no longer resolvable"] };

          const validations = Number.parseInt(agent.stats?.totalValidations || "0", 10) || 0;
          const nextSnapshot = buildSnapshot(agent, validations);
          const changes = diffSnapshot(item.snapshot, nextSnapshot);
          refreshWatchSnapshot(item.id, item.network, nextSnapshot, address);
          return { ...item, agent, changes };
        } catch {
          return { ...item, agent: null, changes: ["Failed to refresh"] };
        }
      })
    );
    setRows(resolved);
    setLoading(false);
  }, [address]);

  React.useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="container mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <div className="mb-2 flex items-center gap-3">
            <Star className="h-6 w-6 text-primary" />
            <h1 className="text-3xl font-bold tracking-tight">Watchlist</h1>
          </div>
          <p className="text-muted-foreground">
            Local watchlist scoped to {isConnected && address ? `wallet ${address}` : "guest profile"}.
          </p>
          <p className="mt-2 rounded-md border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
            Watchlist is stored only in your browser (local storage). This app does not store watchlist data server-side,
            so browser cookies/storage must be enabled.
          </p>
        </div>
        <Button variant="outline" onClick={load}>
          Refresh
        </Button>
      </div>

      {loading ? (
        <div className="flex h-32 items-center justify-center text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          Loading watchlist...
        </div>
      ) : rows.length ? (
        <div className="space-y-3">
          {rows.map((row) => (
            <article key={row.key} className="rounded-xl border border-border/50 bg-card/40 p-4">
              {row.agent ? (
                <>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <Link
                        href={`/agents/${encodeURIComponent(row.id)}?network=${row.network}`}
                        className="text-lg font-semibold hover:underline"
                      >
                        {getDisplayName(row.agent!)}
                      </Link>
                      <div className="text-xs text-muted-foreground">{row.network}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">Quality {computeAgentQualityScore(row.agent!)}</Badge>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          toggleWatchlist(row.agent!, row.network as AgentSubgraphNetwork, 0, address);
                          load();
                        }}
                      >
                        Unstar
                      </Button>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {row.changes.length ? (
                      row.changes.map((change) => (
                        <Badge key={`${row.key}-${change}`} variant="outline" className="border-amber-500/30 bg-amber-500/10 text-amber-300">
                          {change}
                        </Badge>
                      ))
                    ) : (
                      <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-300">
                        No changes since last check
                      </Badge>
                    )}
                  </div>
                </>
              ) : (
                <div className="text-sm text-muted-foreground">Unable to load this watched agent.</div>
              )}
            </article>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-border/50 p-8 text-center text-muted-foreground">
          Watchlist is empty. Star agents from the registry cards.
        </div>
      )}
    </div>
  );
}

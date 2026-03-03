"use client";

import * as React from "react";
import Link from "next/link";
import { ShieldCheck, ShieldAlert, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getAgentSubgraphLabel, type AgentSubgraphNetwork } from "@/lib/agent-networks";

type HighlightsResponse = {
  success: boolean;
  moderation: Array<{
    questionId: string;
    created: number;
    question: string;
    agentId: string | null;
    finalized: boolean;
    answer: "YES" | "NO" | "UNKNOWN" | "OPEN";
  }>;
};

type VerifiedStatus = "active" | "challenged" | "removed";

type VerifiedStreamResponse = {
  success: boolean;
  items: Array<{
    id: string;
    agentId: string;
    name: string;
    network: AgentSubgraphNetwork;
    lookupByAgentId?: boolean;
    status: VerifiedStatus;
    curateStatus: string;
    updatedAt: number;
  }>;
};

type VerifiedFilter = "all" | "active" | "challenged" | "removed";
type ModerationFilter = "all" | "open" | "yes" | "no";

function formatAgo(timestamp: number) {
  const now = Math.floor(Date.now() / 1000);
  const diff = Math.max(0, now - timestamp);
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function verifiedTone(status: VerifiedStatus) {
  if (status === "active") return "border-emerald-500/30 bg-emerald-500/10 text-emerald-300";
  if (status === "challenged") return "border-amber-500/30 bg-amber-500/10 text-amber-300";
  return "border-red-500/30 bg-red-500/10 text-red-300";
}

function moderationTone(answer: "YES" | "NO" | "UNKNOWN" | "OPEN") {
  if (answer === "YES") return "border-red-500/30 bg-red-500/10 text-red-300";
  if (answer === "NO") return "border-emerald-500/30 bg-emerald-500/10 text-emerald-300";
  return "border-amber-500/30 bg-amber-500/10 text-amber-300";
}

export default function TrustPage() {
  const [verified, setVerified] = React.useState<VerifiedStreamResponse["items"]>([]);
  const [moderation, setModeration] = React.useState<HighlightsResponse["moderation"]>([]);
  const [verifiedFilter, setVerifiedFilter] = React.useState<VerifiedFilter>("all");
  const [moderationFilter, setModerationFilter] = React.useState<ModerationFilter>("all");
  const [loading, setLoading] = React.useState(true);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const [verifiedRes, highlightsRes] = await Promise.all([
        fetch("/api/trust/verified", { cache: "no-store" }),
        fetch("/api/home/highlights", { cache: "no-store" }),
      ]);
      const [verifiedJson, highlightsJson] = await Promise.all([
        verifiedRes.json() as Promise<VerifiedStreamResponse>,
        highlightsRes.json() as Promise<HighlightsResponse>,
      ]);
      if (verifiedJson.success) setVerified(verifiedJson.items || []);
      if (highlightsJson.success) setModeration(highlightsJson.moderation || []);
    } catch {
      setVerified([]);
      setModeration([]);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  const filteredVerified = React.useMemo(() => {
    const base = verifiedFilter === "all" ? verified : verified.filter((item) => item.status === verifiedFilter);
    return base
      .slice()
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, 5);
  }, [verified, verifiedFilter]);

  const filteredModeration = React.useMemo(() => {
    let base = moderation;
    if (moderationFilter === "yes") base = moderation.filter((item) => item.answer === "YES");
    else if (moderationFilter === "no") base = moderation.filter((item) => item.answer === "NO");
    else if (moderationFilter === "open") {
      base = moderation.filter((item) => item.answer === "OPEN" || item.answer === "UNKNOWN" || !item.finalized);
    }
    return base
      .slice()
      .sort((a, b) => b.created - a.created)
      .slice(0, 5);
  }, [moderation, moderationFilter]);

  const collateralizedCount = verified.filter((item) => item.status === "active").length;

  return (
    <div className="container mx-auto max-w-7xl overflow-x-hidden px-4 py-10 sm:px-6">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Trust</h1>
          <p className="mt-2 text-muted-foreground">Live trust stream combining collateralized agents and moderation reports.</p>
        </div>
        <Button variant="outline" className="w-full sm:w-auto" onClick={() => void load()}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      {loading ? (
        <div className="flex h-32 items-center justify-center text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          Loading trust stream...
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <section className="flex h-full min-w-0 flex-col overflow-hidden rounded-xl border border-cyan-400/35 bg-card/45 p-4 shadow-[0_0_0_1px_rgba(34,211,238,0.08)_inset,0_0_24px_rgba(34,211,238,0.12)] sm:p-5">
            <div className="mb-3 text-center">
              <div className="mb-2 flex items-center justify-center gap-2">
                <ShieldCheck className="h-5 w-5 text-emerald-400" />
                <h2 className="text-2xl font-bold tracking-tight">Verified Agents</h2>
              </div>
              <div className="mb-2 flex items-center justify-center">
                <Badge variant="outline">{collateralizedCount} collateralized</Badge>
              </div>
              <p className="mx-auto min-h-[4.75rem] max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
                Agents in this list have posted collateral as an economic bond. They are verified, but can still be
                flagged and challenged if misbehavior is reported.
              </p>
            </div>
            <div className="mb-3 flex flex-wrap gap-2">
              <FilterButton active={verifiedFilter === "all"} onClick={() => setVerifiedFilter("all")} label="All" />
              <FilterButton active={verifiedFilter === "active"} onClick={() => setVerifiedFilter("active")} label="Active" />
              <FilterButton
                active={verifiedFilter === "challenged"}
                onClick={() => setVerifiedFilter("challenged")}
                label="Challenged"
              />
              <FilterButton active={verifiedFilter === "removed"} onClick={() => setVerifiedFilter("removed")} label="Removed" />
            </div>
            <div className="max-h-[30rem] flex-1 space-y-2 overflow-auto pr-1">
              {filteredVerified.map((item) => (
                <Link
                  key={`${item.network}:${item.id}`}
                  href={
                    item.lookupByAgentId
                      ? `/agents/${encodeURIComponent(item.agentId)}?network=${item.network}&lookup=agentId`
                      : `/agents/${encodeURIComponent(item.id)}?network=${item.network}`
                  }
                  className="block min-w-0 rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-2 hover:border-emerald-500/40"
                >
                  <div className="truncate text-sm font-medium">{item.name}</div>
                  <div className="mt-1 truncate text-xs text-muted-foreground">{item.agentId}</div>
                  <div className="mt-1 flex min-w-0 flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                    <span className="truncate">{getAgentSubgraphLabel(item.network)}</span>
                    <Badge className={`shrink-0 ${verifiedTone(item.status)}`}>{item.status.toUpperCase()}</Badge>
                    <span className="truncate">{item.curateStatus}</span>
                  </div>
                </Link>
              ))}
              {!filteredVerified.length ? (
                <div className="rounded-lg border border-dashed border-border/50 p-4 text-sm text-muted-foreground">
                  No curated agents for the selected filter.
                </div>
              ) : null}
            </div>
            <div className="mt-3">
              <Button asChild variant="outline" className="w-full">
                <Link href="/verified">Explore</Link>
              </Button>
            </div>
          </section>

          <section className="flex h-full min-w-0 flex-col overflow-hidden rounded-xl border border-cyan-400/35 bg-card/45 p-4 shadow-[0_0_0_1px_rgba(34,211,238,0.08)_inset,0_0_24px_rgba(34,211,238,0.12)] sm:p-5">
            <div className="mb-3 text-center">
              <div className="mb-2 flex items-center justify-center gap-2">
                <ShieldAlert className="h-5 w-5 text-amber-400" />
                <h2 className="text-2xl font-bold tracking-tight">Moderate</h2>
              </div>
              <div className="mb-2 flex items-center justify-center">
                <Badge variant="outline">{moderation.length || 0} reports</Badge>
              </div>
              <p className="mx-auto min-h-[4.75rem] max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
                Reports in this feed flag agents for possible abuse, policy violations, bad metadata, or spam-like behavior.
                A report is a warning signal, not final proof of abuse.
              </p>
            </div>
            <div className="mb-3 flex flex-wrap gap-2">
              <FilterButton active={moderationFilter === "all"} onClick={() => setModerationFilter("all")} label="All" />
              <FilterButton active={moderationFilter === "open"} onClick={() => setModerationFilter("open")} label="Open question" />
              <FilterButton active={moderationFilter === "yes"} onClick={() => setModerationFilter("yes")} label="Yes" />
              <FilterButton active={moderationFilter === "no"} onClick={() => setModerationFilter("no")} label="No" />
            </div>
            <div className="max-h-[30rem] flex-1 space-y-2 overflow-auto pr-1">
              {filteredModeration.map((row) => (
                <Link
                  key={row.questionId}
                  href={`/moderation?q=${encodeURIComponent(row.questionId)}`}
                  className="block min-w-0 rounded-lg border border-border/50 bg-background/60 px-3 py-2 hover:border-border"
                >
                  <div className="flex min-w-0 items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">{row.agentId || row.questionId.slice(0, 12)}</div>
                      <div className="mt-1 truncate text-xs text-muted-foreground">{row.question}</div>
                    </div>
                    <Badge className={`shrink-0 ${moderationTone(row.answer)}`}>{row.answer}</Badge>
                  </div>
                  <div className="mt-1 text-[11px] text-muted-foreground">{formatAgo(row.created)}</div>
                </Link>
              ))}
              {!filteredModeration.length ? (
                <div className="rounded-lg border border-dashed border-border/50 p-4 text-sm text-muted-foreground">
                  No moderation reports for the selected filter.
                </div>
              ) : null}
            </div>
            <div className="mt-3">
              <Button asChild variant="outline" className="w-full">
                <Link href="/moderation">Explore</Link>
              </Button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

function FilterButton({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <Button variant={active ? "default" : "outline"} size="sm" onClick={onClick}>
      {label}
    </Button>
  );
}

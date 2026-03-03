"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Activity,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Loader2,
  MessageSquare,
  Search,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";
import { formatUnits } from "viem";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getDisplayName } from "@/lib/format";
import {
  AGENT_SUBGRAPH_NETWORKS,
  getAgentSubgraphLabel,
  type AgentSubgraphNetwork,
} from "@/lib/agent-networks";
import type { Agent } from "@/types/agent";

type RankedAgent = {
  id: string;
  name: string;
  network: AgentSubgraphNetwork;
  totalFeedback: number;
};

type ActivityItem = {
  kind: "created" | "updated" | "active";
  id: string;
  agentId: string;
  name: string;
  network: AgentSubgraphNetwork;
  timestamp: number;
};

type StatsResponse = {
  success: boolean;
  generatedAt: string;
  stats: {
    totalAgents: number;
    active7d: number;
    totalReviews: number;
  };
  lists: {
    trending: RankedAgent[];
    topRated: RankedAgent[];
    mostReviewed: RankedAgent[];
  };
  activityPreview: ActivityItem[];
};

type HighlightsResponse = {
  success: boolean;
  verifiedAgents: Array<{
    id: string;
    agentId: string;
    name: string;
    network: AgentSubgraphNetwork;
    curateItemUrl?: string;
    stake?: string;
    verifiedAt?: number;
  }>;
  verifiedStakeSymbol?: string;
  verifiedStakeDecimals?: number;
  moderation: Array<{
    questionId: string;
    created: number;
    question: string;
    agentId: string | null;
    finalized: boolean;
    answer: "YES" | "NO" | "UNKNOWN" | "OPEN";
  }>;
};

type AgentPreview = {
  image: string | null;
  description: string | null;
};

type ActivityDigest = {
  id: string;
  name: string;
  agentId: string;
  network: AgentSubgraphNetwork;
  latestTimestamp: number;
  created?: number;
  updated?: number;
  active?: number;
};

type SearchSuggestion = {
  id: string;
  agentId: string;
  name: string;
  image: string | null;
  network: AgentSubgraphNetwork;
};

function formatAgo(timestamp: number) {
  const now = Math.floor(Date.now() / 1000);
  const diff = Math.max(0, now - timestamp);
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function formatStake(raw: string | undefined, decimals = 18) {
  try {
    const value = Number(formatUnits(BigInt(raw || "0"), decimals));
    if (!Number.isFinite(value)) return "0";
    if (value >= 1000) return value.toLocaleString(undefined, { maximumFractionDigits: 0 });
    if (value >= 1) return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
    return value.toLocaleString(undefined, { maximumFractionDigits: 4 });
  } catch {
    return "0";
  }
}

function moderationTone(answer: HighlightsResponse["moderation"][number]["answer"]) {
  if (answer === "YES") return "border-red-500/30 bg-red-500/10 text-red-300";
  if (answer === "NO") return "border-emerald-500/30 bg-emerald-500/10 text-emerald-300";
  return "border-amber-500/30 bg-amber-500/10 text-amber-300";
}

export default function ExplorePage() {
  const router = useRouter();
  const [verifiedFilter, setVerifiedFilter] = React.useState<"highestStake" | "latest">("highestStake");
  const [query, setQuery] = React.useState("");
  const [searchingSuggestions, setSearchingSuggestions] = React.useState(false);
  const [showSuggestions, setShowSuggestions] = React.useState(false);
  const [suggestions, setSuggestions] = React.useState<SearchSuggestion[]>([]);
  const [stats, setStats] = React.useState<StatsResponse | null>(null);
  const [highlights, setHighlights] = React.useState<HighlightsResponse | null>(null);
  const [previewByKey, setPreviewByKey] = React.useState<Record<string, AgentPreview>>({});
  const [loading, setLoading] = React.useState(true);
  const searchPanelRef = React.useRef<HTMLDivElement | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const [statsRes, highlightsRes] = await Promise.allSettled([
        fetch("/api/stats?sampleSize=50000", { cache: "no-store" }),
        fetch("/api/home/highlights", { cache: "no-store" }),
      ]);

      if (statsRes.status === "fulfilled") {
        try {
          const statsJson = (await statsRes.value.json()) as StatsResponse;
          if (statsJson.success) setStats(statsJson);
        } catch {
          // Keep previous stats if parse fails.
        }
      }

      if (highlightsRes.status === "fulfilled") {
        try {
          const highlightsJson = (await highlightsRes.value.json()) as HighlightsResponse;
          if (highlightsJson.success) setHighlights(highlightsJson);
        } catch {
          // Keep previous highlights if parse fails.
        }
      }
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  React.useEffect(() => {
    const onWindowPointerDown = (event: MouseEvent) => {
      if (!searchPanelRef.current) return;
      if (!searchPanelRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };
    window.addEventListener("mousedown", onWindowPointerDown);
    return () => window.removeEventListener("mousedown", onWindowPointerDown);
  }, []);

  React.useEffect(() => {
    const handle = window.setTimeout(async () => {
      const trimmed = query.trim();
      if (trimmed.length < 2) {
        setSuggestions([]);
        return;
      }

      setSearchingSuggestions(true);
      try {
        const groups = await Promise.all(
          AGENT_SUBGRAPH_NETWORKS.map(async (network) => {
            const res = await fetch(
              `/api/agents?q=${encodeURIComponent(trimmed)}&network=${encodeURIComponent(network)}&pageSize=4`,
              { cache: "no-store" }
            );
            if (!res.ok) return [] as SearchSuggestion[];
            const json = await res.json();
            const items = (json?.items || []) as Agent[];
            return items.map((item) => ({
              id: item.id,
              agentId: item.agentId,
              name: getDisplayName(item),
              image: item.registrationFile?.image || null,
              network,
            }));
          })
        );

        const unique = new Map<string, SearchSuggestion>();
        for (const group of groups) {
          for (const item of group) unique.set(`${item.network}:${item.id}`, item);
        }
        setSuggestions(Array.from(unique.values()).slice(0, 8));
      } catch {
        setSuggestions([]);
      } finally {
        setSearchingSuggestions(false);
      }
    }, 260);

    return () => window.clearTimeout(handle);
  }, [query]);

  React.useEffect(() => {
    let cancelled = false;
    async function hydratePreviews() {
      if (!stats) return;
      const ranked = [...(stats.lists.topRated || []).slice(0, 20), ...(stats.lists.mostReviewed || []).slice(0, 20)];

      const unique = new Map<string, RankedAgent>();
      for (const item of ranked) unique.set(`${item.network}:${item.id}`, item);

      const toFetch = Array.from(unique.values()).filter((item) => !previewByKey[`${item.network}:${item.id}`]);
      if (!toFetch.length) return;

      const updates = await Promise.all(
        toFetch.map(async (item) => {
          const key = `${item.network}:${item.id}`;
          try {
            const res = await fetch(`/api/agents/${encodeURIComponent(item.id)}?network=${encodeURIComponent(item.network)}`, {
              cache: "no-store",
            });
            if (!res.ok) return [key, { image: null, description: null }] as const;
            const json = await res.json();
            const agent = json?.agent;
            return [
              key,
              {
                image: agent?.registrationFile?.image || null,
                description: agent?.registrationFile?.description || null,
              },
            ] as const;
          } catch {
            return [key, { image: null, description: null }] as const;
          }
        })
      );

      if (cancelled) return;
      setPreviewByKey((prev) => {
        const next = { ...prev };
        for (const [key, value] of updates) next[key] = value;
        return next;
      });
    }

    void hydratePreviews();
    return () => {
      cancelled = true;
    };
  }, [stats, previewByKey]);

  const activityCards = React.useMemo(() => {
    if (!stats?.activityPreview?.length) return [] as ActivityDigest[];
    const byAgent = new Map<string, ActivityDigest>();

    for (const event of stats.activityPreview) {
      const key = `${event.network}:${event.id}`;
      const current = byAgent.get(key) || {
        id: event.id,
        name: event.name,
        agentId: event.agentId,
        network: event.network,
        latestTimestamp: event.timestamp,
      };
      if (event.kind === "created") current.created = Math.max(current.created || 0, event.timestamp);
      if (event.kind === "updated") current.updated = Math.max(current.updated || 0, event.timestamp);
      if (event.kind === "active") current.active = Math.max(current.active || 0, event.timestamp);
      current.latestTimestamp = Math.max(current.latestTimestamp, event.timestamp);
      byAgent.set(key, current);
    }

    return Array.from(byAgent.values())
      .sort((a, b) => b.latestTimestamp - a.latestTimestamp)
      .slice(0, 8);
  }, [stats?.activityPreview]);

  const visibleVerifiedAgents = React.useMemo(() => {
    const rows = [...(highlights?.verifiedAgents || [])];

    rows.sort((a, b) => {
      if (verifiedFilter === "latest") {
        return (Number(b.verifiedAt) || 0) - (Number(a.verifiedAt) || 0);
      }

      const stakeA = BigInt(a.stake || "0");
      const stakeB = BigInt(b.stake || "0");
      if (stakeA === stakeB) return (Number(b.verifiedAt) || 0) - (Number(a.verifiedAt) || 0);
      return stakeA > stakeB ? -1 : 1;
    });

    return rows;
  }, [highlights?.verifiedAgents, verifiedFilter]);

  const onSearch = () => {
    const trimmed = query.trim();
    if (!trimmed) {
      router.push("/agents");
      return;
    }
    setShowSuggestions(false);
    router.push(`/agents?q=${encodeURIComponent(trimmed)}`);
  };

  return (
    <div className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(180deg,#010308_0%,#03070e_52%,#040a12_100%)]" />
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(152deg,rgba(34,211,238,0.08)_0%,transparent_36%)]" />
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(24deg,rgba(16,185,129,0.06)_0%,transparent_34%)]" />

      <main className="container mx-auto max-w-[1200px] px-5 py-12 sm:px-8 sm:py-16">
        <section className="mb-10">
          <h1 className="text-4xl font-black tracking-tight text-white sm:text-5xl">Explore The DEX8004 Ecosystem</h1>
          <p className="mt-3 max-w-3xl text-lg text-white/75">
            Discover trusted agents, monitor moderation signals, and review reputation before interacting.
          </p>
        </section>

        {loading ? (
          <div className="mt-8 flex items-center justify-center py-12 text-white/70">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            Loading explore data...
          </div>
        ) : (
          <>
            <section className="grid gap-4 lg:grid-cols-2">
              <div className="min-w-0 overflow-hidden rounded-xl border border-white/15 bg-black/30 p-4">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-emerald-300" />
                    <h2 className="text-lg font-semibold text-white">Verified agents (Curate)</h2>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setVerifiedFilter("highestStake")}
                      className={`rounded-full border px-2.5 py-1 text-[11px] transition ${
                        verifiedFilter === "highestStake"
                          ? "border-emerald-300/45 bg-emerald-300/15 text-emerald-100"
                          : "border-white/20 bg-white/5 text-white/70 hover:text-white"
                      }`}
                    >
                      Highest stake
                    </button>
                    <button
                      type="button"
                      onClick={() => setVerifiedFilter("latest")}
                      className={`rounded-full border px-2.5 py-1 text-[11px] transition ${
                        verifiedFilter === "latest"
                          ? "border-emerald-300/45 bg-emerald-300/15 text-emerald-100"
                          : "border-white/20 bg-white/5 text-white/70 hover:text-white"
                      }`}
                    >
                      Latest
                    </button>
                    <Link href="/verified" className="text-xs text-cyan-200/80 hover:text-cyan-200 underline underline-offset-4">
                      View All
                    </Link>
                  </div>
                </div>
                <div className="min-h-[13.5rem] max-h-[13.5rem] space-y-2 overflow-x-hidden overflow-y-auto pr-1">
                  {visibleVerifiedAgents.map((item, index) => {
                    const href = item.curateItemUrl || `/agents/${encodeURIComponent(item.id)}?network=${item.network}`;
                    const external = Boolean(item.curateItemUrl);
                    const verifiedAt = Number(item.verifiedAt || 0);
                    const topStake = verifiedFilter === "highestStake" && index === 0;
                    const podiumStake = verifiedFilter === "highestStake" && index < 3;
                    const stakeValue = formatStake(item.stake, Number(highlights?.verifiedStakeDecimals || 18));
                    return (
                      <Link
                        key={`${item.network}:${item.id}`}
                        href={href}
                        target={external ? "_blank" : undefined}
                        rel={external ? "noreferrer" : undefined}
                        className={`block h-[66px] min-w-0 rounded-md border px-2.5 py-1.5 text-xs text-white/85 transition ${
                          topStake
                            ? "border-emerald-300/45 bg-gradient-to-r from-emerald-500/18 to-cyan-500/12 shadow-[0_0_0_1px_rgba(110,231,183,0.08),0_0_18px_rgba(16,185,129,0.22)]"
                            : podiumStake
                              ? "border-emerald-500/28 bg-emerald-500/10 shadow-[0_0_0_1px_rgba(110,231,183,0.04),0_0_12px_rgba(16,185,129,0.1)]"
                              : "border-emerald-500/20 bg-emerald-500/8 shadow-[0_0_0_1px_rgba(110,231,183,0.03),0_0_10px_rgba(16,185,129,0.08)] hover:border-emerald-500/40 hover:shadow-[0_0_0_1px_rgba(110,231,183,0.08),0_0_14px_rgba(16,185,129,0.12)]"
                        }`}
                      >
                        <div className="flex h-full min-w-0 flex-col justify-between">
                          <div className="flex min-w-0 items-start justify-between gap-2">
                            <div className="min-w-0 truncate text-sm font-medium">
                              {item.name} <span className="text-[10px] text-white/45">#{item.agentId}</span>
                            </div>
                            {podiumStake ? (
                              <Badge className="shrink-0 border-emerald-300/40 bg-emerald-300/18 px-1.5 py-0 text-[10px] text-emerald-100">
                                #{index + 1}
                              </Badge>
                            ) : null}
                          </div>
                          <div className="flex min-w-0 items-center justify-between gap-2 text-[10px]">
                            <span className="truncate rounded-full border border-emerald-300/40 bg-emerald-300/16 px-1.5 py-0.5 font-semibold text-emerald-100">
                              Stake {stakeValue} {highlights?.verifiedStakeSymbol || "TOKEN"}
                            </span>
                            <span className="shrink-0 text-white/55">{verifiedAt > 0 ? formatAgo(verifiedAt) : "-"}</span>
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>

              <div className="min-w-0 overflow-hidden rounded-xl border border-white/15 bg-black/30 p-4">
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <ShieldAlert className="h-4 w-4 text-amber-300" />
                  <h2 className="text-lg font-semibold text-white">Recent moderation abuse reports</h2>
                </div>
                <div className="min-h-[13.5rem] max-h-[13.5rem] space-y-2 overflow-x-hidden overflow-y-auto pr-1">
                  {(highlights?.moderation || []).slice(0, 14).map((row) => (
                    <Link
                      key={row.questionId}
                      href={`/moderation?q=${encodeURIComponent(row.questionId)}`}
                      className="block h-[66px] min-w-0 rounded-md border border-white/10 bg-white/5 px-2.5 py-1.5 hover:border-white/25"
                    >
                      <div className="flex h-full min-w-0 flex-col justify-between">
                        <div className="flex min-w-0 items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="truncate text-sm font-medium text-white">{row.agentId || row.questionId.slice(0, 12)}</div>
                            <div className="truncate text-[10px] text-white/60">{row.question}</div>
                          </div>
                          <Badge className={`shrink-0 px-1.5 py-0 text-[10px] ${moderationTone(row.answer)}`}>{row.answer}</Badge>
                        </div>
                        <div className="flex min-w-0 items-center justify-between gap-2 text-[10px] text-white/55">
                          <span className="truncate">{row.questionId.slice(0, 12)}...</span>
                          <span className="shrink-0">{formatAgo(row.created)}</span>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            </section>

            <section className="mt-10 sm:mt-12">
              <div className="flex flex-col gap-3 sm:flex-row">
                <div ref={searchPanelRef} className="relative flex-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/60" />
                  <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onFocus={() => setShowSuggestions(true)}
                    onKeyDown={(e) => (e.key === "Enter" ? onSearch() : null)}
                    placeholder="Search by name, owner, entity id, or agent id"
                    className="h-11 w-full rounded-lg border border-white/20 bg-black/30 pl-10 pr-4 text-sm text-white placeholder:text-white/55 focus:border-cyan-300 focus:outline-none focus:ring-2 focus:ring-cyan-300/20"
                  />
                  {showSuggestions && query.trim().length >= 2 ? (
                    <div className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-40 rounded-lg border border-white/15 bg-[#0b0d14]/95 p-2 shadow-xl backdrop-blur">
                      {searchingSuggestions ? (
                        <div className="flex items-center gap-2 px-2 py-3 text-xs text-white/70">
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          Searching agents...
                        </div>
                      ) : suggestions.length > 0 ? (
                        <div className="space-y-1">
                          {suggestions.map((item) => (
                            <Link
                              key={`${item.network}:${item.id}`}
                              href={`/agents/${encodeURIComponent(item.id)}?network=${item.network}`}
                              onClick={() => setShowSuggestions(false)}
                              className="flex items-center gap-2 rounded-md border border-transparent px-2 py-1.5 hover:border-cyan-300/35 hover:bg-white/5"
                            >
                              <div className="h-8 w-8 shrink-0 overflow-hidden rounded-md bg-white/5">
                                {item.image ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img src={item.image} alt={item.name} className="h-full w-full object-cover" />
                                ) : (
                                  <div className="flex h-full w-full items-center justify-center text-[10px] text-white/65">AI</div>
                                )}
                              </div>
                              <div className="min-w-0">
                                <div className="truncate text-sm text-white">{item.name}</div>
                                <div className="truncate text-[11px] text-white/60">
                                  {item.agentId} | {getAgentSubgraphLabel(item.network)}
                                </div>
                              </div>
                            </Link>
                          ))}
                        </div>
                      ) : (
                        <div className="px-2 py-3 text-xs text-white/65">No matching agents found.</div>
                      )}
                    </div>
                  ) : null}
                </div>
                <Button className="h-11 border border-cyan-300/40 bg-cyan-300/20 text-white hover:bg-cyan-300/30" onClick={onSearch}>
                  Search
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
                <Button asChild variant="outline" className="h-11 border-white/20 bg-white/5 text-white hover:bg-white/10">
                  <Link href="/agents">Open Full Registry</Link>
                </Button>
              </div>
            </section>

            <section className="mt-12 space-y-6">
              <AgentCarousel
                title="Top Rated"
                icon={Clock3}
                items={(stats?.lists.topRated || []).slice(0, 14)}
                previewByKey={previewByKey}
              />
              <AgentCarousel
                title="Most Reviewed"
                icon={MessageSquare}
                items={(stats?.lists.mostReviewed || []).slice(0, 14)}
                previewByKey={previewByKey}
              />
            </section>

            <section className="mt-12">
              <div className="mb-3 flex items-center gap-2">
                <Activity className="h-4 w-4 text-cyan-300" />
                <h2 className="text-lg font-semibold text-white">Recent activity</h2>
              </div>
              <div className="grid gap-2 md:grid-cols-2">
                {activityCards.map((item) => (
                  <Link
                    key={`${item.network}:${item.id}`}
                    href={`/agents/${encodeURIComponent(item.id)}?network=${item.network}`}
                    className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm hover:border-white/25"
                  >
                    <div className="min-w-0 space-y-1">
                      <div className="truncate font-medium text-white">{item.name}</div>
                      <div className="truncate text-xs text-white/65">
                        {item.agentId} | {getAgentSubgraphLabel(item.network)}
                      </div>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-white/60">
                        <span>{item.created ? `Created ${formatAgo(item.created)}` : "Created -"}</span>
                        <span>{item.updated ? `Updated ${formatAgo(item.updated)}` : "Updated -"}</span>
                        <span>{item.active ? `Active ${formatAgo(item.active)}` : "Active -"}</span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}

function AgentCarousel({
  title,
  icon: Icon,
  items,
  previewByKey,
}: {
  title: string;
  icon: React.ElementType;
  items: RankedAgent[];
  previewByKey: Record<string, AgentPreview>;
}) {
  const scrollerRef = React.useRef<HTMLDivElement | null>(null);
  const [canScrollLeft, setCanScrollLeft] = React.useState(false);
  const [canScrollRight, setCanScrollRight] = React.useState(false);

  const updateScrollState = React.useCallback(() => {
    const node = scrollerRef.current;
    if (!node) {
      setCanScrollLeft(false);
      setCanScrollRight(false);
      return;
    }
    setCanScrollLeft(node.scrollLeft > 8);
    setCanScrollRight(node.scrollLeft + node.clientWidth < node.scrollWidth - 8);
  }, []);

  React.useEffect(() => {
    updateScrollState();
    const node = scrollerRef.current;
    if (!node) return;
    const onScroll = () => updateScrollState();
    node.addEventListener("scroll", onScroll);
    window.addEventListener("resize", onScroll);
    return () => {
      node.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [items, updateScrollState]);

  const scrollByCards = (direction: "left" | "right") => {
    const node = scrollerRef.current;
    if (!node) return;
    node.scrollBy({
      left: direction === "left" ? -280 : 280,
      behavior: "smooth",
    });
  };

  return (
    <section>
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-cyan-300" />
          <h3 className="text-lg font-semibold text-white">{title}</h3>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => scrollByCards("left")}
            disabled={!canScrollLeft}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/20 bg-white/5 text-white/80 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-30"
            aria-label={`Scroll ${title} left`}
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => scrollByCards("right")}
            disabled={!canScrollRight}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-cyan-300/35 bg-cyan-300/12 text-cyan-100 transition hover:bg-cyan-300/22 disabled:cursor-not-allowed disabled:opacity-30"
            aria-label={`Scroll ${title} right`}
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
      <div
        ref={scrollerRef}
        className="flex snap-x gap-3 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {items.map((item) => {
          const key = `${item.network}:${item.id}`;
          const preview = previewByKey[key];
          return (
            <Link
              key={`${title}-${key}`}
              href={`/agents/${encodeURIComponent(item.id)}?network=${item.network}`}
              className="group block w-[230px] shrink-0 snap-start overflow-hidden rounded-xl border border-white/10 bg-white/[0.03] hover:border-cyan-300/40"
            >
              <div className="h-28 w-full overflow-hidden bg-gradient-to-br from-cyan-900/30 via-emerald-900/20 to-slate-900/20">
                {preview?.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={preview.image} alt={item.name} className="h-full w-full object-cover transition group-hover:scale-[1.03]" />
                ) : (
                  <div className="flex h-full items-center justify-center text-xs text-white/60">No image</div>
                )}
              </div>
              <div className="p-3">
                <div className="truncate text-sm font-medium text-white">{item.name}</div>
                <div className="mt-1 text-xs text-white/65">
                  {getAgentSubgraphLabel(item.network)} | Reviews {item.totalFeedback}
                </div>
                <div className="mt-2 line-clamp-2 text-xs text-white/55">
                  {preview?.description || "Open this card to view complete metadata and trust signals."}
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

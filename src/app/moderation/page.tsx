"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useRealityQuestions } from "@/lib/reality/use-questions";
import { usePublicClient } from "wagmi";
import { REALITIO_ABI } from "@/lib/abi/realitio";
import { useRealitioAddress } from "@/lib/reality/use-realitio-address";
import { bytes32ToYesNo } from "@/lib/reality/encoding";
import { formatEther } from "viem";
import { AnswerDialog, RequestArbitrationButton } from "@/components/reality/question-actions";
import { follow, unfollow, isFollowed } from "@/lib/reality/moderation-storage";
import { flagAgent, parseAgentIdFromQuestionText } from "@/lib/reality/abuse-flags";
import { getAddressExplorerUrl, getAgentNetworkFromAgentId } from "@/lib/block-explorer";
import { AGENT_SUBGRAPH_NETWORKS, type AgentSubgraphNetwork } from "@/lib/agent-networks";
import { Eye, EyeOff, Clock, CheckCircle2, AlertCircle, ExternalLink, MessageSquare, Shield, Gavel } from "lucide-react";

function formatTimeRemaining(finalizeTs: number): string {
  const now = Math.floor(Date.now() / 1000);
  const diff = finalizeTs - now;
  if (diff <= 0) return "Finalizing…";
  const hours = Math.floor(diff / 3600);
  const days = Math.floor(hours / 24);
  if (days > 0) return `${days}d ${hours % 24}h`;
  return `${hours}h ${Math.floor((diff % 3600) / 60)}m`;
}

function getStatusBadge(finalized: boolean | undefined, bestAnswer: `0x${string}` | undefined) {
  if (finalized === undefined) {
    return { label: "Loading", variant: "secondary" as const, icon: Clock };
  }
  if (finalized && bestAnswer) {
    const answer = bytes32ToYesNo(bestAnswer);
    if (answer === "YES") {
      return { label: "Confirmed Abuse", variant: "destructive" as const, icon: AlertCircle };
    }
    return { label: "Resolved — No Abuse", variant: "default" as const, icon: CheckCircle2 };
  }
  return { label: "Awaiting Answers", variant: "secondary" as const, icon: MessageSquare };
}

function parseQuestionDisplay(question: string): { title: string; subtitle?: string; agentId?: string } {
  const parsedAgentId = parseAgentIdFromQuestionText(question);
  const agentId = parsedAgentId ?? undefined;

  const agentName = question.match(/AgentName:\s*([^\n\r]+)/i)?.[1]?.trim();
  const claim = question.match(/Claim:\s*([^\n\r]+)/i)?.[1]?.trim();
  const fallback = question.replace(/\s+/g, " ").trim();

  const title = agentName
    ? `Agent: ${agentName}`
    : agentId
      ? `Agent: ${agentId}`
      : "Reported agent";

  const subtitleRaw = claim || fallback;
  const subtitle = subtitleRaw.length > 180 ? `${subtitleRaw.slice(0, 177)}…` : subtitleRaw;

  return { title, subtitle, agentId };
}

export default function ModerationPage() {
  const router = useRouter();
  const qs = useRealityQuestions();
  const realitio = useRealitioAddress();
  const publicClient = usePublicClient();

  const [query, setQuery] = React.useState("");
  const [expandedId, setExpandedId] = React.useState<`0x${string}` | null>(null);
  const [details, setDetails] = React.useState<Map<`0x${string}`, {
    best: `0x${string}`;
    bond: bigint;
    minBond: bigint;
    finalized: boolean;
    finalizeTs: number;
  }>>(new Map());
  const [openingAgentQuestionId, setOpeningAgentQuestionId] = React.useState<`0x${string}` | null>(null);

  const openModeratedAgent = React.useCallback(
    async (agentId: string, questionId: `0x${string}`) => {
      const inferredNetwork = getAgentNetworkFromAgentId(agentId);
      const networksToTry: AgentSubgraphNetwork[] = inferredNetwork
        ? [inferredNetwork]
        : ["sepolia", ...AGENT_SUBGRAPH_NETWORKS.filter((n) => n !== "sepolia")];

      setOpeningAgentQuestionId(questionId);

      try {
        for (const network of networksToTry) {
          const res = await fetch(
            `/api/agents/by-agent-id?agentId=${encodeURIComponent(agentId)}&network=${encodeURIComponent(network)}`
          );
          if (!res.ok) continue;
          const payload = await res.json();
          if (payload?.success && payload?.found && payload?.item?.id) {
            router.push(
              `/agents/${encodeURIComponent(payload.item.id)}?network=${network}&source=moderation&questionId=${questionId}`
            );
            return;
          }
        }

        const fallbackNetwork = inferredNetwork || "sepolia";
        router.push(
          `/agents/${encodeURIComponent(agentId)}?network=${fallbackNetwork}&lookup=agentId&source=moderation&questionId=${questionId}`
        );
      } finally {
        setOpeningAgentQuestionId((current) => (current === questionId ? null : current));
      }
    },
    [router]
  );

  const filtered = qs.data.filter((q) => {
    if (!query.trim()) return true;
    const ql = query.toLowerCase();
    return (
      q.questionId.toLowerCase().includes(ql) ||
      q.question.toLowerCase().includes(ql) ||
      q.user.toLowerCase().includes(ql)
    );
  });

  // Load details for expanded question
  React.useEffect(() => {
    if (!expandedId || !publicClient || realitio.status !== "idle" || !realitio.address) return;
    if (details.has(expandedId)) return;

    const questionId = expandedId;
    const client = publicClient;
    const address = realitio.address as `0x${string}`;

    let cancelled = false;
    async function loadDetails() {
      try {
        const [best, bond, minBond, finalized, finalizeTs] = await Promise.all([
          client.readContract({
            address,
            abi: REALITIO_ABI,
            functionName: "getBestAnswer",
            args: [questionId],
          }),
          client.readContract({
            address,
            abi: REALITIO_ABI,
            functionName: "getBond",
            args: [questionId],
          }),
          client.readContract({
            address,
            abi: REALITIO_ABI,
            functionName: "getMinBond",
            args: [questionId],
          }),
          client.readContract({
            address,
            abi: REALITIO_ABI,
            functionName: "isFinalized",
            args: [questionId],
          }),
          client.readContract({
            address,
            abi: REALITIO_ABI,
            functionName: "getFinalizeTS",
            args: [questionId],
          }),
        ]);

        if (finalized && bytes32ToYesNo(best as `0x${string}`) === "YES") {
          const q = qs.data.find((x) => x.questionId === questionId);
          const agentId = q ? parseAgentIdFromQuestionText(q.question) : null;
          if (agentId) flagAgent(agentId, questionId);
        }

        if (!cancelled) {
          setDetails((prev) => new Map(prev).set(questionId, {
            best: best as `0x${string}`,
            bond: bond as bigint,
            minBond: minBond as bigint,
            finalized: Boolean(finalized),
            finalizeTs: Number(finalizeTs as bigint | number),
          }));
        }
      } catch {
        // Silently fail
      }
    }
    loadDetails();
    return () => { cancelled = true; };
  }, [expandedId, publicClient, realitio.status, realitio.address, qs.data, details]);

  return (
    <TooltipProvider>
      <div className="container mx-auto max-w-6xl overflow-x-hidden px-4 py-10 sm:px-6">
        {/* Header */}
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <Gavel className="h-6 w-6 text-primary" />
              <h1 className="text-3xl font-bold tracking-tight">Moderation</h1>
            </div>
            <p className="text-muted-foreground">
              Agents in this list were flagged as potentially abusive by community reports.
            </p>
            <p className="mt-2 rounded-md border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
              A flag is not final proof of abuse. If you believe an agent follows the rules, you can answer against
              the claim and potentially earn the bond if unchallenged, or escalate to arbitration when needed.
            </p>
          </div>
          <Badge variant="outline" className="w-fit px-4 py-1.5">
            Sepolia Testnet
          </Badge>
        </div>

        {/* Search */}
        <div className="rounded-xl border border-border/50 bg-card/50 backdrop-blur-sm p-4 mb-6">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Shield className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search reports by agent, question, or ID..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="pl-10 h-11"
              />
            </div>
            <div className="text-sm text-muted-foreground flex items-center px-2">
              {qs.status === "loading" ? (
                "Loading reports..."
              ) : (
                `${filtered.length} report${filtered.length !== 1 ? "s" : ""}`
              )}
            </div>
          </div>
        </div>

        {/* Questions Grid */}
        {qs.status === "error" ? (
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-8 text-center">
            <AlertCircle className="h-10 w-10 text-destructive mx-auto mb-3" />
            <p className="text-destructive font-medium">{qs.error}</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border/50 p-12 text-center">
            <MessageSquare className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
            <p className="text-muted-foreground text-lg">No reports found</p>
            {query && (
              <p className="text-sm text-muted-foreground mt-2">
                Try adjusting your search
              </p>
            )}
          </div>
        ) : (
          <div className="grid gap-4">
            {filtered.map((q) => {
              const display = parseQuestionDisplay(q.question);
              const status = getStatusBadge(q.finalized, q.bestAnswer);
              const StatusIcon = status.icon;
              const isExpanded = expandedId === q.questionId;
              const detail = details.get(q.questionId);
              const followed = isFollowed(q.questionId);

              return (
                <div
                  key={q.questionId} 
                  className={`overflow-hidden rounded-xl border border-border/50 bg-card/50 p-4 backdrop-blur-sm transition-all sm:p-5 ${isExpanded ? 'ring-1 ring-primary shadow-lg shadow-primary/5' : 'hover:border-border'}`}
                >
                  {/* Header Row */}
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="flex-1 min-w-0">
                      {/* Status Badges */}
                      <div className="flex items-center gap-2 flex-wrap mb-3">
                        <Badge variant={status.variant} className="shrink-0 font-medium">
                          <StatusIcon className="h-3 w-3 mr-1.5" />
                          {status.label}
                        </Badge>
                        {display.agentId && (
                          <Badge variant="outline" className="font-mono text-xs">
                            {display.agentId.slice(0, 16)}...
                          </Badge>
                        )}
                        {q.finalized === false && q.finalizeTs && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Badge variant="outline" className="text-xs font-normal">
                                <Clock className="h-3 w-3 mr-1" />
                                {formatTimeRemaining(q.finalizeTs)}
                              </Badge>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Time remaining until finalization</p>
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </div>
                      
                      <h3 className="break-all text-base font-semibold leading-tight">
                        {display.title}
                      </h3>
                      {display.subtitle && (
                        <p className="mt-1 break-all text-sm leading-relaxed text-muted-foreground">
                          {display.subtitle}
                        </p>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex w-full shrink-0 flex-wrap items-center gap-2 lg:w-auto lg:justify-end">
                      {display.agentId ? (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-9 w-full rounded-lg sm:w-auto"
                          disabled={openingAgentQuestionId === q.questionId}
                          onClick={() => {
                            if (display.agentId) openModeratedAgent(display.agentId, q.questionId);
                          }}
                        >
                          {openingAgentQuestionId === q.questionId ? "Opening..." : "Open agent"}
                        </Button>
                      ) : null}
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            size="icon"
                            variant={followed ? "default" : "ghost"}
                            className="h-9 w-9 rounded-lg"
                            onClick={() => {
                              if (followed) {
                                unfollow(q.questionId);
                              } else {
                                follow(q.questionId);
                              }
                            }}
                          >
                            {followed ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>{followed ? "Unfollow" : "Follow"} this report</p>
                        </TooltipContent>
                      </Tooltip>
                      
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-9 rounded-lg"
                        onClick={() => setExpandedId(isExpanded ? null : q.questionId)}
                      >
                        {isExpanded ? "Less" : "Details"}
                      </Button>
                    </div>
                  </div>

                  {/* Stats Grid */}
                  <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {/* Leading Answer */}
                    <div className="flex items-center justify-between sm:justify-start gap-3 rounded-lg bg-background border border-border/30 px-3 py-2.5">
                      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Leading</span>
                      {q.bestAnswer ? (
                        <Badge variant={bytes32ToYesNo(q.bestAnswer) === "YES" ? "destructive" : "default"} className="text-xs">
                          {bytes32ToYesNo(q.bestAnswer)}
                        </Badge>
                      ) : (
                        <span className="text-sm text-muted-foreground">No answers</span>
                      )}
                    </div>
                    
                    {/* Current Bond */}
                    {q.bond !== undefined && (
                      <div className="flex items-center justify-between sm:justify-start gap-3 rounded-lg bg-background border border-border/30 px-3 py-2.5">
                        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Bond</span>
                        <span className="font-mono text-sm font-medium">{formatEther(q.bond)} ETH</span>
                      </div>
                    )}
                    
                    <div className="hidden lg:block" />
                  </div>

                  {/* Action Buttons */}
                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <AnswerDialog questionId={q.questionId} questionPrompt="Is the abuse report correct?" />
                    <RequestArbitrationButton questionId={q.questionId} />
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-9 rounded-lg"
                      asChild
                    >
                      <a
                        href={`https://reality.eth.limo/app/#!/question/${q.questionId}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                        View on Reality.eth
                      </a>
                    </Button>
                  </div>

                  {/* Expanded Details */}
                  {isExpanded && (
                    <div className="mt-5 pt-5 border-t border-border/30 space-y-4">
                      {/* IDs Grid */}
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div className="space-y-1.5">
                          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Question ID</span>
                          <code className="block text-xs font-mono bg-background border border-border/30 p-3 rounded-lg break-all">
                            {q.questionId}
                          </code>
                        </div>
                        <div className="space-y-1.5">
                          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Created by</span>
                          <div className="block text-xs font-mono bg-background border border-border/30 p-3 rounded-lg break-all">
                            {(() => {
                              const userExplorerUrl = getAddressExplorerUrl(q.user, 11155111);
                              return userExplorerUrl ? (
                                <a
                                  href={userExplorerUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="underline-offset-2 hover:underline"
                                >
                                  {q.user}
                                </a>
                              ) : (
                                q.user
                              );
                            })()}
                          </div>
                        </div>
                      </div>

                      {/* Detail Stats */}
                      {detail ? (
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                          <div className="bg-background border border-border/30 rounded-lg p-3">
                            <div className="text-xs text-muted-foreground uppercase tracking-wider">Best Answer</div>
                            <div className="font-medium mt-1">{bytes32ToYesNo(detail.best)}</div>
                          </div>
                          <div className="bg-background border border-border/30 rounded-lg p-3">
                            <div className="text-xs text-muted-foreground uppercase tracking-wider">Bond</div>
                            <div className="font-medium mt-1 font-mono">{formatEther(detail.bond)} ETH</div>
                          </div>
                          <div className="bg-background border border-border/30 rounded-lg p-3">
                            <div className="text-xs text-muted-foreground uppercase tracking-wider">Min Bond</div>
                            <div className="font-medium mt-1 font-mono">{formatEther(detail.minBond)} ETH</div>
                          </div>
                          <div className="bg-background border border-border/30 rounded-lg p-3">
                            <div className="text-xs text-muted-foreground uppercase tracking-wider">Finalized</div>
                            <div className="font-medium mt-1">{detail.finalized ? "Yes" : "No"}</div>
                          </div>
                        </div>
                      ) : (
                        <div className="text-sm text-muted-foreground">Loading details...</div>
                      )}

                      {/* Full Question */}
                      <div className="bg-background border border-border/30 rounded-lg p-4">
                        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Full question</div>
                        <p className="text-sm break-words leading-relaxed">{q.question}</p>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}

"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ChallengeAgentDialog } from "@/components/pgtcr/challenge-agent-dialog";
import { useAccount, useChainId, useReadContract, useWriteContract } from "wagmi";
import { sepolia } from "wagmi/chains";
import { formatUnits } from "viem";
import { ERC20_ABI } from "@/lib/abi/erc20";
import PermanentGTCRAbi from "@/lib/abi/PermanentGTCR.json";

function short(value?: string | null) {
  if (!value) return "-";
  return `${value.slice(0, 6)}…${value.slice(-4)}`;
}

export default function SubmissionFallbackPage() {
  const params = useParams();
  const itemID = decodeURIComponent(String(params.itemID || ""));

  const [loading, setLoading] = React.useState(true);
  const [item, setItem] = React.useState<any | null>(null);
  const [registry, setRegistry] = React.useState<any | null>(null);
  const [withdrawing, setWithdrawing] = React.useState(false);
  const [withdrawConfirmOpen, setWithdrawConfirmOpen] = React.useState(false);

  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { writeContractAsync } = useWriteContract();

  React.useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const [iRes, rRes] = await Promise.all([
          fetch(`/api/pgtcr/item?itemID=${encodeURIComponent(itemID)}`, { cache: "no-store" }),
          fetch("/api/pgtcr/registry", { cache: "no-store" }),
        ]);
        const [iJson, rJson] = await Promise.all([iRes.json(), rRes.json()]);
        if (cancelled) return;
        setItem(iJson?.success ? iJson.item : null);
        setRegistry(rJson?.success ? rJson.registry : null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    if (itemID) void load();
    return () => {
      cancelled = true;
    };
  }, [itemID]);

  const tokenAddress = registry?.token as `0x${string}` | undefined;
  const tokenSymbol = useReadContract({
    address: tokenAddress,
    abi: ERC20_ABI,
    functionName: "symbol",
    query: { enabled: Boolean(tokenAddress) },
  }).data as string | undefined;
  const tokenDecimals = useReadContract({
    address: tokenAddress,
    abi: ERC20_ABI,
    functionName: "decimals",
    query: { enabled: Boolean(tokenAddress) },
  }).data as number | undefined;

  const withdrawingPeriod = useReadContract({
    address: (registry?.id ?? undefined) as `0x${string}` | undefined,
    abi: PermanentGTCRAbi as any,
    functionName: "withdrawingPeriod",
    query: { enabled: Boolean(registry?.id) },
  }).data as bigint | undefined;

  const submitter = item?.submitter as string | undefined;


  const itemStatus = String(item?.status || "");
  const withdrawingTimestamp = Number(String(item?.withdrawingTimestamp || "0"));
  const withdrawingPeriodSec = withdrawingPeriod ? Number(withdrawingPeriod) : null;
  const nowSec = Math.floor(Date.now() / 1000);
  const withdrawingPeriodLabel = (() => {
    if (!withdrawingPeriodSec) return "the configured withdrawal period";
    const d = Math.floor(withdrawingPeriodSec / 86400);
    const h = Math.floor((withdrawingPeriodSec % 86400) / 3600);
    if (d > 0) return `${d}d ${h}h`;
    const m = Math.floor((withdrawingPeriodSec % 3600) / 60);
    return `${h}h ${m}m`;
  })();

  const canManageWithdraw = Boolean(
    isConnected &&
      address &&
      submitter &&
      address.toLowerCase() === submitter.toLowerCase() &&
      chainId === sepolia.id &&
      registry?.id &&
      itemStatus &&
      itemStatus !== "Absent"
  );

  const canStartWithdraw = Boolean(canManageWithdraw && withdrawingTimestamp === 0);
  const canFinalizeWithdraw = Boolean(
    canManageWithdraw &&
      withdrawingTimestamp > 0 &&
      withdrawingPeriodSec !== null &&
      nowSec >= withdrawingTimestamp + withdrawingPeriodSec
  );



  async function onWithdraw() {
    if (!canManageWithdraw) return;
    setWithdrawing(true);
    try {
      await writeContractAsync({
        address: registry.id as `0x${string}` ,
        abi: PermanentGTCRAbi as any,
        functionName: withdrawingTimestamp === 0 ? "startWithdrawItem" : "withdrawItem",
        args: [itemID as `0x${string}`],
      } as any);
      window.setTimeout(() => window.location.reload(), 1000);
    } finally {
      setWithdrawing(false);
    }
  }

  const collateral = (() => {
    try {
      return BigInt(item?.stake || "0");
    } catch {
      return 0n;
    }
  })();

  return (
    <div className="container mx-auto max-w-4xl px-6 py-10">
      <h1 className="text-2xl font-bold">Submission found (agent unresolved)</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        The agent was not found in the selected chain subgraph, but a Curate submission exists and you can still interact with it here.
      </p>

      {loading ? (
        <div className="mt-8 text-sm text-muted-foreground">Loading submission…</div>
      ) : !item ? (
        <div className="mt-8 rounded-lg border border-border p-4 text-sm text-muted-foreground">Submission not found.</div>
      ) : (
        <div className="mt-8 space-y-4">
          <div className="rounded-lg border border-border p-5">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">{String(item.status || "Unknown")}</Badge>
              <Badge variant="outline" className="font-mono">ItemID {short(itemID)}</Badge>
              <Badge variant="outline" className="font-mono">
                Collateral {tokenDecimals !== undefined ? formatUnits(collateral, tokenDecimals) : collateral.toString()} {tokenSymbol || ""}
              </Badge>
            </div>
            <div className="mt-3 text-sm text-muted-foreground">
              Submitter: <span className="font-mono">{short(submitter)}</span>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2">

              <ChallengeAgentDialog itemID={itemID} />
              {canStartWithdraw ? (
                <Button size="sm" variant="outline" onClick={() => setWithdrawConfirmOpen(true)} disabled={withdrawing || chainId !== sepolia.id}>
                  {withdrawing ? "Starting…" : "Start withdraw"}
                </Button>
              ) : null}

              {canFinalizeWithdraw ? (
                <Button size="sm" variant="outline" onClick={() => void onWithdraw()} disabled={withdrawing || chainId !== sepolia.id}>
                  {withdrawing ? "Withdrawing…" : "Withdraw"}
                </Button>
              ) : null}

              {canManageWithdraw && withdrawingTimestamp > 0 && !canFinalizeWithdraw ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge variant="secondary">Withdraw initiated by owner</Badge>
                  </TooltipTrigger>
                  <TooltipContent>
                    During this period, the item is still registered and the owner remains expected to keep it compliant until withdrawal can be finalized.
                  </TooltipContent>
                </Tooltip>
              ) : null}
            </div>
          </div>

            <Dialog open={withdrawConfirmOpen} onOpenChange={setWithdrawConfirmOpen}>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>Withdraw Item Warning</DialogTitle>
                </DialogHeader>
                <div className="space-y-3 text-sm text-muted-foreground">
                  <p><span className="font-medium text-foreground">Once you start the withdrawal process,</span> this item will be removed from the registry after the withdrawal period. This action cannot be undone.</p>
                  <p><span className="font-medium text-foreground">Withdrawal Timing.</span> Withdrawing an item takes <span className="font-mono">{withdrawingPeriodLabel}</span>. After starting the withdrawal, you must wait for this period to complete before the item is permanently removed from the registry.</p>
                  <p>Are you sure you want to withdraw this agent from the registry? This will initiate the withdrawal period after which the item will be permanently removed.</p>
                </div>
                <div className="mt-4 flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setWithdrawConfirmOpen(false)}>Cancel</Button>
                  <Button
                    onClick={() => {
                      setWithdrawConfirmOpen(false);
                      void onWithdraw();
                    }}
                    disabled={withdrawing || chainId !== sepolia.id}
                  >
                    {withdrawing ? "Starting…" : "Start withdraw"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>

          <div className="rounded-lg border border-cyan-400/25 bg-cyan-500/5 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-sm font-semibold text-cyan-200">Curate Item</div>
                <div className="text-xs text-muted-foreground">Open the full item record in Curate.</div>
              </div>
              <Button asChild variant="outline" size="sm" className="border-cyan-400/35 text-cyan-200 hover:bg-cyan-400/10">
                <Link href={`https://curate.kleros.io/tcr/11155111/${registry?.id || ""}/${itemID}`} target="_blank" rel="noreferrer">
                  View on Curate
                </Link>
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import * as React from "react";
import { toast } from "sonner";
import { useAccount, useChainId, useReadContract, useWriteContract } from "wagmi";
import { sepolia } from "wagmi/chains";
import { formatEther, formatUnits } from "viem";

import PermanentGTCRAbi from "@/lib/abi/PermanentGTCR.json";
import { ERC20_ABI } from "@/lib/abi/erc20";
import { IARBITRATOR_ABI } from "@/lib/abi/iArbitrator";
import { uploadFileToIpfs, uploadJsonToIpfs } from "@/lib/ipfs";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type RegistryApiResponse =
  | {
      success: true;
      registry: {
        id: string;
        token: string;
        arbitrator: { id: string };
        challengeStakeMultiplier: string;
        winnerStakeMultiplier: string;
        loserStakeMultiplier: string;
        sharedStakeMultiplier: string;
        arbitrationSettings: Array<{ metaEvidenceURI: string; arbitratorExtraData: string }>;
      };
    }
  | { success: false; error: string };

type ItemApiResponse =
  | {
      success: true;
      item: {
        itemID: string;
        status: string;
        stake: string;
        arbitrationDeposit: string;
        challenges: Array<{
          disputeID: string;
          resolutionTime?: string | null;
          challenger: string;
          challengerStake: string;
          itemStake: string;
          arbitrationSetting: { arbitratorExtraData: string };
          rounds: Array<{
            appealPeriodStart: string;
            appealPeriodEnd: string;
            ruling: string;
            hasPaidRequester: boolean;
            hasPaidChallenger: boolean;
            amountPaidRequester: string;
            amountPaidChallenger: string;
          }>;
        }>;
      } | null;
    }
  | { success: false; error: string };

const PARTY_REQUESTER = 1;
const PARTY_CHALLENGER = 2;

function mulDiv(a: bigint, b: bigint, div: bigint): bigint {
  if (div === 0n) return 0n;
  return (a * b) / div;
}

export function ChallengeAgentDialog(props: { itemID: string }) {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { writeContractAsync } = useWriteContract();

  const [open, setOpen] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [registry, setRegistry] = React.useState<RegistryApiResponse | null>(null);
  const [item, setItem] = React.useState<ItemApiResponse | null>(null);
  const [approvalStepDone, setApprovalStepDone] = React.useState(false);

  const [title, setTitle] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [file, setFile] = React.useState<File | null>(null);

  const onSepolia = chainId === sepolia.id;

  const registryAddress = registry && registry.success ? (registry.registry.id as `0x${string}`) : undefined;
  const tokenAddress = registry && registry.success ? (registry.registry.token as `0x${string}`) : undefined;
  const arbitratorAddress = registry && registry.success ? (registry.registry.arbitrator.id as `0x${string}`) : undefined;
  const arbitratorExtraData = registry && registry.success ? (registry.registry.arbitrationSettings?.[0]?.arbitratorExtraData as `0x${string}`) : undefined;

  const multiplierDivisor = useReadContract({
    address: registryAddress,
    abi: PermanentGTCRAbi as any,
    functionName: "MULTIPLIER_DIVISOR",
    query: { enabled: Boolean(registryAddress) },
  }).data as bigint | undefined;

  const tokenDecimals = useReadContract({
    address: tokenAddress,
    abi: ERC20_ABI,
    functionName: "decimals",
    query: { enabled: Boolean(tokenAddress) },
  }).data as number | undefined;

  const tokenSymbol = useReadContract({
    address: tokenAddress,
    abi: ERC20_ABI,
    functionName: "symbol",
    query: { enabled: Boolean(tokenAddress) },
  }).data as string | undefined;

  const arbitrationCost = useReadContract({
    address: arbitratorAddress,
    abi: IARBITRATOR_ABI,
    functionName: "arbitrationCost",
    args: arbitratorExtraData ? [arbitratorExtraData] : undefined,
    query: { enabled: Boolean(arbitratorAddress && arbitratorExtraData) },
  }).data as bigint | undefined;

  const itemStake = item && item.success && item.item ? BigInt(item.item.stake || "0") : 0n;
  const challengeStakeMultiplier = registry && registry.success ? BigInt(registry.registry.challengeStakeMultiplier || "0") : 0n;

  const requiredChallengeStake = React.useMemo(() => {
    if (!multiplierDivisor) return 0n;
    return mulDiv(itemStake, challengeStakeMultiplier, multiplierDivisor);
  }, [itemStake, challengeStakeMultiplier, multiplierDivisor]);

  const allowance = useReadContract({
    address: tokenAddress,
    abi: ERC20_ABI,
    functionName: "allowance",
    args: address && registryAddress ? [address, registryAddress] : undefined,
    query: { enabled: Boolean(address && tokenAddress && registryAddress) },
  }).data as bigint | undefined;

  const needsApproval = Boolean(allowance !== undefined && allowance < requiredChallengeStake);

  React.useEffect(() => {
    if (!open) return;
    setApprovalStepDone(false);
    let cancelled = false;
    async function load() {
      try {
        const [rRes, iRes] = await Promise.all([
          fetch("/api/pgtcr/registry", { cache: "no-store" }),
          fetch(`/api/pgtcr/item?itemID=${encodeURIComponent(props.itemID)}`, { cache: "no-store" }),
        ]);
        const [rJson, iJson] = await Promise.all([
          rRes.json() as Promise<RegistryApiResponse>,
          iRes.json() as Promise<ItemApiResponse>,
        ]);
        if (cancelled) return;
        setRegistry(rJson);
        setItem(iJson);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to load item");
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [open, props.itemID]);

  async function ensureApprovalIfNeeded() {
    if (!needsApproval || approvalStepDone) return true;
    if (!tokenAddress || !registryAddress) return false;
    setSubmitting(true);
    try {
      await writeContractAsync({
        address: tokenAddress,
        abi: ERC20_ABI,
        functionName: "approve",
        args: [registryAddress, requiredChallengeStake],
      });
      toast.success("Approval sent. Click again to submit challenge.");
      setApprovalStepDone(true);
      return true;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Approval failed");
      return false;
    } finally {
      setSubmitting(false);
    }
  }

  async function onChallenge() {
    if (!isConnected || !address) {
      toast.error("Connect your wallet to challenge.");
      return;
    }
    if (!onSepolia) {
      toast.error("Switch to Sepolia.");
      return;
    }
    if (!registryAddress) {
      toast.error("Registry not loaded.");
      return;
    }
    if (!arbitrationCost && arbitrationCost !== 0n) {
      toast.error("Arbitration cost not available.");
      return;
    }
    if (needsApproval && !approvalStepDone) {
      await ensureApprovalIfNeeded();
      return;
    }

    const t = title.trim();
    const d = description.trim();
    if (t.length < 3 || d.length < 10) {
      toast.error("Add a title and a description.");
      return;
    }

    setSubmitting(true);
    try {
      let fileURI: string | undefined;
      let type: string | undefined;
      let fileTypeExtension: string | undefined;

      if (file) {
        fileURI = await uploadFileToIpfs(file, { operation: "evidence", pinToGraph: false });
        type = file.type || undefined;
        const ext = file.name.split(".").pop();
        fileTypeExtension = ext && ext.length <= 8 ? ext : undefined;
      }

      const evidenceJson: Record<string, unknown> = { title: t, description: d };
      if (fileURI) evidenceJson.fileURI = fileURI;
      if (type) evidenceJson.type = type;
      if (fileTypeExtension) evidenceJson.fileTypeExtension = fileTypeExtension;

      const evidenceUri = await uploadJsonToIpfs(evidenceJson, { operation: "evidence", pinToGraph: false });

      await writeContractAsync({
        address: registryAddress,
        abi: PermanentGTCRAbi as any,
        functionName: "challengeItem",
        args: [props.itemID as `0x${string}`, evidenceUri],
        value: arbitrationCost,
      });

      toast.success("Challenge submitted.");
      setOpen(false);
      setTitle("");
      setDescription("");
      setFile(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Challenge failed");
    } finally {
      setSubmitting(false);
    }
  }

  // -------- Dispute display + funding --------

  const latestChallenge = item && item.success && item.item ? item.item.challenges?.[0] : null;
  const activeDispute = latestChallenge && !latestChallenge.resolutionTime ? latestChallenge : null;
  const latestRound = activeDispute?.rounds?.[0] || null;

  const disputeID = activeDispute ? BigInt(activeDispute.disputeID || "0") : 0n;

  const appealCost = useReadContract({
    address: arbitratorAddress,
    abi: IARBITRATOR_ABI,
    functionName: "appealCost",
    args: activeDispute && arbitratorExtraData ? [disputeID, arbitratorExtraData] : undefined,
    query: { enabled: Boolean(activeDispute && arbitratorAddress && arbitratorExtraData) },
  }).data as bigint | undefined;

  const winnerStakeMultiplier = registry && registry.success ? BigInt(registry.registry.winnerStakeMultiplier || "0") : 0n;
  const loserStakeMultiplier = registry && registry.success ? BigInt(registry.registry.loserStakeMultiplier || "0") : 0n;
  const sharedStakeMultiplier = registry && registry.success ? BigInt(registry.registry.sharedStakeMultiplier || "0") : 0n;

  function multiplierForSide(side: number): bigint {
    if (!latestRound) return sharedStakeMultiplier;
    const ruling = latestRound.ruling;
    if (ruling === "None") return sharedStakeMultiplier;

    // Ruling enum in subgraph: None/Accept/Reject
    const requesterWins = ruling === "Accept";
    const sideIsRequester = side === PARTY_REQUESTER;
    const sideWins = sideIsRequester ? requesterWins : !requesterWins;
    return sideWins ? winnerStakeMultiplier : loserStakeMultiplier;
  }

  function totalFeeForSide(side: number): bigint {
    if (!appealCost || !multiplierDivisor) return 0n;
    const m = multiplierForSide(side);
    return appealCost + mulDiv(appealCost, m, multiplierDivisor);
  }


  const nowSec = Math.floor(Date.now() / 1000);

  function rulingKind(r: string | undefined): "none" | "requester" | "challenger" {
    const v = String(r || "").toLowerCase();
    if (!v || v === "none" || v === "0") return "none";
    if (v === "accept" || v === "1" || v === "requester") return "requester";
    if (v === "reject" || v === "2" || v === "challenger") return "challenger";
    return "none";
  }

  function sideName(side: number) {
    return side === PARTY_REQUESTER ? "Requester" : "Challenger";
  }

  function sideFundingState(side: number): { canFund: boolean; reason?: string } {
    if (!activeDispute || !latestRound) return { canFund: false, reason: "No active appeal round." };

    const start = Number(latestRound.appealPeriodStart || "0");
    const end = Number(latestRound.appealPeriodEnd || "0");
    if (!start || !end || nowSec < start) return { canFund: false, reason: "Appeal period not open yet." };

    const rk = rulingKind(latestRound.ruling);
    const sideIsRequester = side === PARTY_REQUESTER;

    const hasPaid = sideIsRequester ? latestRound.hasPaidRequester : latestRound.hasPaidChallenger;
    if (hasPaid) return { canFund: false, reason: "This side is already fully funded." };

    const deadline = rk === "none"
      ? end
      : ((rk === "requester") === sideIsRequester ? end : Math.floor(start + (end - start) / 2));

    if (nowSec >= deadline) {
      return {
        canFund: false,
        reason: rk === "none" ? "Appeal period closed." : `Funding window closed for ${sideName(side)} side.`,
      };
    }

    const paid = BigInt(sideIsRequester ? latestRound.amountPaidRequester : latestRound.amountPaidChallenger);
    const total = totalFeeForSide(side);
    if (total <= paid) return { canFund: false, reason: "This side is already fully funded." };

    return { canFund: true };
  }

  async function onFundAppeal(side: number) {
    if (!isConnected || !address) {
      toast.error("Connect your wallet.");
      return;
    }
    if (!onSepolia) {
      toast.error("Switch to Sepolia.");
      return;
    }
    if (!registryAddress || !activeDispute || !latestRound) {
      toast.error("No active dispute.");
      return;
    }

    const fundingState = sideFundingState(side);
    if (!fundingState.canFund) {
      toast.error(fundingState.reason || "Funding not available for this side right now.");
      return;
    }

    const paid = BigInt(side === PARTY_REQUESTER ? latestRound.amountPaidRequester : latestRound.amountPaidChallenger);
    const total = totalFeeForSide(side);
    const remaining = total > paid ? total - paid : 0n;
    if (remaining === 0n) {
      toast.message("This side is already fully funded.");
      return;
    }

    setSubmitting(true);
    try {
      await writeContractAsync({
        address: registryAddress,
        abi: PermanentGTCRAbi as any,
        functionName: "fundAppeal",
        args: [props.itemID as `0x${string}`, side],
        value: remaining,
      });
      toast.success("Appeal contribution sent.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Funding failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">Challenge Agent</Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Challenge Agent (PGTCR)</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-md border border-border bg-muted/20 p-3 text-xs text-muted-foreground space-y-1">
            <div>ItemID: <span className="font-mono">{props.itemID}</span></div>
            <div>
              Required challenge stake: {tokenDecimals !== undefined ? (
                <span className="font-mono">{formatUnits(requiredChallengeStake, tokenDecimals)} {tokenSymbol || "TOKEN"}</span>
              ) : (
                <span className="font-mono">{requiredChallengeStake.toString()}</span>
              )}
            </div>
            <div>
              Arbitration cost (msg.value): {arbitrationCost !== undefined ? <span className="font-mono">{formatEther(arbitrationCost)} ETH</span> : "-"}
            </div>
          </div>

          {activeDispute ? (
            <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-4">
              <div className="font-medium text-amber-200">Dispute active</div>
              <div className="mt-1 text-xs text-amber-200/80 space-y-1">
                <div>Dispute ID: <span className="font-mono">{activeDispute.disputeID}</span></div>
                <div>Challenger: <span className="font-mono">{activeDispute.challenger}</span></div>
                {latestRound ? (
                  <>
                    <div>Appeal period end: <span className="font-mono">{new Date(Number(latestRound.appealPeriodEnd) * 1000).toLocaleString()}</span></div>
                    <div>Ruling: <span className="font-mono">{latestRound.ruling}</span></div>
                  </>
                ) : null}
                <div className="mt-2 flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => void onFundAppeal(PARTY_REQUESTER)}
                    disabled={submitting || !sideFundingState(PARTY_REQUESTER).canFund}
                    title={sideFundingState(PARTY_REQUESTER).reason}
                  >
                    Fund appeal (Requester)
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => void onFundAppeal(PARTY_CHALLENGER)}
                    disabled={submitting || !sideFundingState(PARTY_CHALLENGER).canFund}
                    title={sideFundingState(PARTY_CHALLENGER).reason}
                  >
                    Fund appeal (Challenger)
                  </Button>
                <div className="text-[11px] text-amber-200/80">
                  Loser side can only fund in the first half of the appeal period; winner side can fund until period end.
                </div>
                  <Button asChild size="sm" variant="outline">
                    <a href={`https://klerosboard.com/#!/dispute/${sepolia.id}/${activeDispute.disputeID}`} target="_blank" rel="noreferrer">
                      Klerosboard
                    </a>
                  </Button>
                </div>
              </div>
            </div>
          ) : null}

          <div className="space-y-2">
            <Label>Evidence title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Short summary" />
          </div>
          <div className="space-y-2">
            <Label>Evidence description</Label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="min-h-[120px] w-full rounded-md border border-border bg-background p-2 text-sm"
              placeholder="Explain why this agent should be challenged."
            />
          </div>
          <div className="space-y-2">
            <Label>Attachment (optional)</Label>
            <Input type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} />
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <Button className="sm:flex-1" onClick={() => void onChallenge()} disabled={submitting || !isConnected || !onSepolia}>
              {submitting
                ? "Working…"
                : needsApproval && !approvalStepDone
                  ? `Approve ${tokenSymbol || "token"}`
                  : "Challenge"}
            </Button>
          </div>

          {!isConnected ? <div className="text-xs text-muted-foreground">Connect your wallet to continue.</div> : null}
          {isConnected && !onSepolia ? <div className="text-xs text-red-300">Wrong network. Switch to Sepolia.</div> : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}

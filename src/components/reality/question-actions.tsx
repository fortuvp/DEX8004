"use client";

import * as React from "react";
import { toast } from "sonner";
import { useAccount, useChainId, usePublicClient, useWriteContract } from "wagmi";
import { sepolia } from "wagmi/chains";
import { parseEther } from "viem";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { REALITIO_ABI } from "@/lib/abi/realitio";
import { realityProxyContract } from "@/lib/reality/contracts";
import { useRealitioAddress } from "@/lib/reality/use-realitio-address";
import { type YesNo, yesNoToBytes32 } from "@/lib/reality/encoding";
import { getTxExplorerUrl, truncateHash } from "@/lib/block-explorer";

export function AnswerDialog({
  questionId,
  questionPrompt,
}: {
  questionId: `0x${string}`;
  questionPrompt?: string;
}) {
  const { isConnected } = useAccount();
  const chainId = useChainId();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();
  const realitio = useRealitioAddress();

  const onSepolia = chainId === sepolia.id;

  const [open, setOpen] = React.useState(false);
  const [answer, setAnswer] = React.useState<YesNo>("YES");
  const [bondEth, setBondEth] = React.useState("0.01");
  const [loading, setLoading] = React.useState(false);

  async function submit() {
    if (!isConnected) return toast.error("Connect your wallet.");
    if (!onSepolia) return toast.error("Switch to Sepolia.");
    if (!publicClient) return toast.error("Public client not available.");
    if (realitio.status !== "idle" || !realitio.address) {
      return toast.error(realitio.status === "error" ? realitio.error : "Loading Realitio…");
    }

    let value: bigint;
    try {
      value = parseEther(bondEth as `${number}`);
    } catch {
      return toast.error("Invalid bond.");
    }

    setLoading(true);
    try {
      const hash = await writeContractAsync({
        address: realitio.address,
        abi: REALITIO_ABI,
        functionName: "submitAnswer",
        args: [questionId, yesNoToBytes32(answer), 0n],
        value,
      });
      toast.success("Answer submitted.");
      const txExplorerUrl = getTxExplorerUrl(hash, chainId);
      toast.message(
        txExplorerUrl ? (
          <a href={txExplorerUrl} target="_blank" rel="noreferrer" className="underline">
            Tx: {truncateHash(hash)}
          </a>
        ) : (
          `Tx: ${hash}`
        )
      );
      setOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to submit answer");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">Answer</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Submit answer</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {questionPrompt ? (
            <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
              {questionPrompt}
            </div>
          ) : null}
          <div className="flex gap-2">
            <Button
              size="sm"
              variant={answer === "YES" ? "default" : "outline"}
              onClick={() => setAnswer("YES")}
            >
              YES
            </Button>
            <Button
              size="sm"
              variant={answer === "NO" ? "default" : "outline"}
              onClick={() => setAnswer("NO")}
            >
              NO
            </Button>
          </div>

          <div className="space-y-2">
            <Label htmlFor="bond">Bond (ETH)</Label>
            <Input id="bond" value={bondEth} onChange={(e) => setBondEth(e.target.value)} />
            <div className="text-xs text-muted-foreground">
              Higher bonds can override previous answers.
            </div>
          </div>

          <Button className="w-full" onClick={submit} disabled={!isConnected || !onSepolia || loading}>
            {loading ? "Submitting…" : "Submit"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function RequestArbitrationButton({ questionId }: { questionId: `0x${string}` }) {
  const { isConnected } = useAccount();
  const chainId = useChainId();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();
  const [loading, setLoading] = React.useState(false);
  const onSepolia = chainId === sepolia.id;

  async function onClick() {
    if (!isConnected) return toast.error("Connect your wallet.");
    if (!onSepolia) return toast.error("Switch to Sepolia.");
    if (!publicClient) return toast.error("Public client not available.");

    setLoading(true);
    try {
      const fee = (await publicClient.readContract({
        ...realityProxyContract,
        functionName: "getDisputeFee",
        args: [questionId],
      })) as { fee: bigint } | bigint;

      const feeWei = typeof fee === "bigint" ? fee : fee.fee;

      const hash = await writeContractAsync({
        ...realityProxyContract,
        functionName: "requestArbitration",
        args: [questionId, 0n],
        value: feeWei,
      });
      toast.success("Arbitration requested.");
      const txExplorerUrl = getTxExplorerUrl(hash, chainId);
      toast.message(
        txExplorerUrl ? (
          <a href={txExplorerUrl} target="_blank" rel="noreferrer" className="underline">
            Tx: {truncateHash(hash)}
          </a>
        ) : (
          `Tx: ${hash}`
        )
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to request arbitration");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button size="sm" variant="outline" onClick={onClick} disabled={!isConnected || !onSepolia || loading}>
      {loading ? "Requesting…" : "Request arbitration"}
    </Button>
  );
}

"use client";

import * as React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useAccount, useChainId, useWriteContract } from "wagmi";
import { sepolia } from "wagmi/chains";
import { parseEther, isAddress } from "viem";
import { escrowContract } from "@/lib/marketplace/escrow";
import { getTxExplorerUrl, truncateHash } from "@/lib/block-explorer";

type Props = {
  agentId: string;
  agentName?: string;
  agentUri?: string | null;
  owner: `0x${string}`;
};

export function CreateOfferDialog({ agentId, agentName, agentUri, owner }: Props) {
  const { isConnected } = useAccount();
  const chainId = useChainId();
  const { writeContractAsync } = useWriteContract();

  const [open, setOpen] = React.useState(false);
  const [amountEth, setAmountEth] = React.useState("");
  const [expirationHours, setExpirationHours] = React.useState("1");
  const [message, setMessage] = React.useState("");

  const onSepolia = chainId === sepolia.id;

  async function onSubmit() {
    if (!isConnected) {
      toast.error("Connect your wallet to create an offer.");
      return;
    }
    if (!onSepolia) {
      toast.error("Switch to Sepolia to use the testnet escrow.");
      return;
    }
    if (!isAddress(owner)) {
      toast.error("Invalid owner address.");
      return;
    }

    let value: bigint;
    try {
      value = parseEther(amountEth as `${number}`);
    } catch {
      toast.error("Invalid amount.");
      return;
    }
    if (value <= 0n) {
      toast.error("Amount must be greater than zero.");
      return;
    }

    const metaEvidence = JSON.stringify({
      kind: "erc8004-agent-offer",
      agentId,
      agentName,
      agentUri,
      note: message || undefined,
    });

    // Escrow expects timeoutPayment in seconds.
    const exp = expirationHours.trim();
    const timeoutPaymentSeconds = exp ? BigInt(Math.max(0, Math.floor(Number(exp) * 60 * 60))) : 0n;

    try {
      toast.message("Preparing transaction…");
      const hash = await writeContractAsync({
        ...escrowContract,
        functionName: "createTransaction",
        args: [timeoutPaymentSeconds, owner, metaEvidence],
        value,
      });
      toast.success("Offer submitted on-chain.");
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
      setAmountEth("");
      setMessage("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to create offer");
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">Make offer</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Make an offer</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="text-sm text-muted-foreground">
            Receiver is set automatically to the current agent owner.
          </div>

          <div className="space-y-2">
            <Label htmlFor="amount">Offer amount (ETH)</Label>
            <Input
              id="amount"
              inputMode="decimal"
              placeholder="0.05"
              value={amountEth}
              onChange={(e) => setAmountEth(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="expiration">Expiration (hours)</Label>
            <Input
              id="expiration"
              inputMode="decimal"
              placeholder="1"
              value={expirationHours}
              onChange={(e) => setExpirationHours(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="message">Message (optional)</Label>
            <Input
              id="message"
              placeholder="Short note…"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
          </div>

          <Button className="w-full" onClick={onSubmit} disabled={!isConnected || !onSepolia}>
            Submit offer
          </Button>
          {!isConnected ? (
            <div className="text-xs text-muted-foreground">Connect your wallet to continue.</div>
          ) : null}
          {isConnected && !onSepolia ? (
            <div className="text-xs text-red-300">Wrong network. Switch to Sepolia.</div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}

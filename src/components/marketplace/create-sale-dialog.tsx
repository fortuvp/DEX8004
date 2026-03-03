"use client";

import * as React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useAccount, useChainId } from "wagmi";
import { sepolia } from "wagmi/chains";
import { isAddress, parseEther } from "viem";
import { upsertSaleRequest } from "@/lib/marketplace/storage";
import type { SaleRequest } from "@/lib/marketplace/types";

type Props = {
  agentId: string;
  agentName?: string;
};

export function CreateSaleDialog({ agentId, agentName }: Props) {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const onSepolia = chainId === sepolia.id;

  const [open, setOpen] = React.useState(false);
  const [receiver, setReceiver] = React.useState("");
  const [amountEth, setAmountEth] = React.useState("");
  const [note, setNote] = React.useState("");

  function onSubmit() {
    if (!isConnected || !address) {
      toast.error("Connect your wallet to create a sale.");
      return;
    }
    if (!onSepolia) {
      toast.error("Switch to Sepolia to use the testnet marketplace.");
      return;
    }
    if (!isAddress(receiver)) {
      toast.error("Receiver address is invalid.");
      return;
    }

    let amountWei: bigint;
    try {
      amountWei = parseEther(amountEth as `${number}`);
    } catch {
      toast.error("Invalid amount.");
      return;
    }
    if (amountWei <= 0n) {
      toast.error("Amount must be greater than zero.");
      return;
    }

    const req: SaleRequest = {
      id: `${Date.now()}-${agentId}`,
      createdAt: Date.now(),
      agentId,
      agentName,
      seller: address,
      receiverToPay: receiver as `0x${string}`,
      amountWei: amountWei.toString(),
      note: note || undefined,
    };

    upsertSaleRequest(req);
    toast.success("Sale request created.");
    setOpen(false);
    setReceiver("");
    setAmountEth("");
    setNote("");
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">Sell / Create sale</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create sale request</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="text-sm text-muted-foreground">
            This escrow contract requires the payer to create the on-chain transaction.
            This form creates a request (stored locally) that the receiver can fulfill with “Pay and complete”.
          </div>

          <div className="space-y-2">
            <Label htmlFor="receiver">Receiver address (payer)</Label>
            <Input
              id="receiver"
              placeholder="0x…"
              value={receiver}
              onChange={(e) => setReceiver(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="amount">Price (ETH)</Label>
            <Input
              id="amount"
              inputMode="decimal"
              placeholder="0.05"
              value={amountEth}
              onChange={(e) => setAmountEth(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="note">Note (optional)</Label>
            <Input
              id="note"
              placeholder="Short instructions…"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>

          <Button className="w-full" onClick={onSubmit} disabled={!isConnected || !onSepolia}>
            Create sale request
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

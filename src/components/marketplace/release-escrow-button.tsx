"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { useAccount, useChainId, useWriteContract } from "wagmi";
import { sepolia } from "wagmi/chains";
import { escrowContract } from "@/lib/marketplace/escrow";
import { AlertTriangle } from "lucide-react";
import { getAddressExplorerUrl, getTxExplorerUrl, truncateHash } from "@/lib/block-explorer";

interface ReleaseEscrowButtonProps {
  transactionId: bigint;
  receiverAddress: `0x${string}`;
  amountEth: string;
}

export function ReleaseEscrowButton({
  transactionId,
  receiverAddress,
  amountEth,
}: ReleaseEscrowButtonProps) {
  const { isConnected } = useAccount();
  const chainId = useChainId();
  const { writeContractAsync } = useWriteContract();
  const [loading, setLoading] = React.useState(false);
  const [open, setOpen] = React.useState(false);

  const onSepolia = chainId === sepolia.id;

  async function onConfirm() {
    if (!isConnected) {
      toast.error("Connect your wallet to continue.");
      return;
    }
    if (!onSepolia) {
      toast.error("Switch to Sepolia.");
      return;
    }

    setLoading(true);
    try {
      const hash = await writeContractAsync({
        ...escrowContract,
        functionName: "executeTransaction",
        args: [transactionId],
      });
      toast.success("Escrow funds released to seller.");
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
      toast.error(e instanceof Error ? e.message : "Failed to release escrow");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          size="sm"
          variant="default"
          disabled={!isConnected || !onSepolia}
        >
          Complete the transaction
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Release Escrow Funds
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 space-y-3">
            <p className="text-sm font-medium text-amber-700 dark:text-amber-400">
              You are about to release escrow funds.
            </p>
            
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Amount to release:</span>
                <span className="font-mono font-medium">{amountEth} ETH</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Receiver:</span>
                {(() => {
                  const receiverExplorerUrl = getAddressExplorerUrl(receiverAddress, sepolia.id);
                  return receiverExplorerUrl ? (
                    <a
                      href={receiverExplorerUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="font-mono text-xs underline-offset-2 hover:underline"
                    >
                      {receiverAddress.slice(0, 6)}...{receiverAddress.slice(-4)}
                    </a>
                  ) : (
                    <span className="font-mono text-xs">{receiverAddress.slice(0, 6)}...{receiverAddress.slice(-4)}</span>
                  );
                })()}
              </div>
            </div>
          </div>

          <div className="space-y-2 text-sm text-muted-foreground">
            <p>
              Once released, the funds will be sent to the receiver address. 
              This action cannot be undone.
            </p>
            <p>
              This is a decentralized blockchain action. No platform or intermediary 
              can reverse it after confirmation.
            </p>
          </div>

          <div className="flex gap-2 pt-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setOpen(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              variant="default"
              className="flex-1"
              onClick={onConfirm}
              disabled={loading}
            >
              {loading ? "Releasing…" : "Confirm Release"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

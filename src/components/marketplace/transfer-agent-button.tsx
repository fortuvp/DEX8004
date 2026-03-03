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
import { AlertTriangle } from "lucide-react";
import { getAddressExplorerUrl, getTxExplorerUrl, truncateHash } from "@/lib/block-explorer";
import { AGENT_REGISTRY_SEPOLIA_ADDRESS } from "@/lib/contracts/addresses";

// transferOwnership selector: 0xf2fde38b
// Function: transferOwnership(address newOwner)
const TRANSFER_OWNERSHIP_ABI = [
  {
    inputs: [{ internalType: "address", name: "newOwner", type: "address" }],
    name: "transferOwnership",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
] as const;

interface TransferAgentOwnershipButtonProps {
  transactionId: bigint;
  buyerAddress: `0x${string}`;
  agentId?: string;
}

export function TransferAgentOwnershipButton({
  transactionId,
  buyerAddress,
  agentId,
}: TransferAgentOwnershipButtonProps) {
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
        address: AGENT_REGISTRY_SEPOLIA_ADDRESS,
        abi: TRANSFER_OWNERSHIP_ABI,
        functionName: "transferOwnership",
        args: [buyerAddress],
      });
      toast.success("Agent ownership transferred to buyer.");
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
      toast.error(e instanceof Error ? e.message : "Failed to transfer ownership");
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
          className="w-full"
        >
          Send agent and claim funds
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Transfer Agent Ownership
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 space-y-3">
            <p className="text-sm font-medium text-amber-700 dark:text-amber-400">
              You are about to transfer ownership of your agent.
            </p>
            
            <div className="space-y-2 text-sm">
              {agentId && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Agent ID:</span>
                  <span className="font-mono text-xs">{agentId.slice(0, 20)}...</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">New owner (buyer):</span>
                {(() => {
                  const buyerExplorerUrl = getAddressExplorerUrl(buyerAddress, sepolia.id);
                  return buyerExplorerUrl ? (
                    <a
                      href={buyerExplorerUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="font-mono text-xs underline-offset-2 hover:underline"
                    >
                      {buyerAddress.slice(0, 6)}...{buyerAddress.slice(-4)}
                    </a>
                  ) : (
                    <span className="font-mono text-xs">{buyerAddress.slice(0, 6)}...{buyerAddress.slice(-4)}</span>
                  );
                })()}
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Transaction ID:</span>
                <span className="font-mono text-xs">#{transactionId.toString()}</span>
              </div>
            </div>
          </div>

          <div className="space-y-2 text-sm text-muted-foreground">
            <p>
              This action will transfer the agent ownership to the buyer address shown above.
            </p>
            <p>
              Once transferred, you cannot undo this action. The buyer will then be able to 
              release the escrow funds to complete the sale.
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
              {loading ? "Transferring…" : "Confirm Transfer"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

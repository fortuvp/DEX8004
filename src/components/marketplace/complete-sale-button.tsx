"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useAccount, useChainId, useWriteContract } from "wagmi";
import { sepolia } from "wagmi/chains";
import { escrowContract } from "@/lib/marketplace/escrow";
import { getTxExplorerUrl, truncateHash } from "@/lib/block-explorer";

export function CompleteSaleButton({ transactionId }: { transactionId: bigint }) {
  const { isConnected } = useAccount();
  const chainId = useChainId();
  const { writeContractAsync } = useWriteContract();
  const [loading, setLoading] = React.useState(false);

  const onSepolia = chainId === sepolia.id;

  async function onClick() {
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
      toast.success("Sale completed.");
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
      toast.error(e instanceof Error ? e.message : "Failed to complete");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button size="sm" variant="outline" onClick={onClick} disabled={!isConnected || !onSepolia || loading}>
      {loading ? "Completing…" : "Complete sale"}
    </Button>
  );
}

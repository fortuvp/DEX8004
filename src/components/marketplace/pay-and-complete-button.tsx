"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useAccount, useChainId, usePublicClient, useWriteContract } from "wagmi";
import { sepolia } from "wagmi/chains";
import { decodeEventLog, isAddress } from "viem";
import { escrowContract } from "@/lib/marketplace/escrow";
import { getTxExplorerUrl, truncateHash } from "@/lib/block-explorer";

export function PayAndCompleteButton(props: {
  seller: `0x${string}`;
  amountWei: bigint;
  metaEvidence: string;
}) {
  const { isConnected } = useAccount();
  const chainId = useChainId();
  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient();
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
    if (!isAddress(props.seller)) {
      toast.error("Invalid seller address.");
      return;
    }

    if (!publicClient) {
      toast.error("Public client not available.");
      return;
    }

    setLoading(true);
    try {
      // 1) Create transaction with timeoutPayment=0 so it can be executed immediately.
      const hash1 = await writeContractAsync({
        ...escrowContract,
        functionName: "createTransaction",
        args: [0n, props.seller, props.metaEvidence],
        value: props.amountWei,
      });
      toast.success("Payment sent to escrow.");

      const receipt = await publicClient.waitForTransactionReceipt({ hash: hash1 });

      // Extract transactionID from TransactionCreated event.
      let transactionId: bigint | null = null;
      for (const log of receipt.logs) {
        try {
          const decoded = decodeEventLog({
            abi: escrowContract.abi,
            data: log.data,
            topics: log.topics,
          });
          if (decoded.eventName === "TransactionCreated") {
            transactionId = decoded.args._transactionID as bigint;
            break;
          }
        } catch {
          // ignore non-matching logs
        }
      }

      if (transactionId === null) {
        toast.message(
          "Escrow created, but could not detect its id from logs. You can still complete it from ‘My escrows’."
        );
        return;
      }

      // 2) Execute immediately (releases escrow amount to receiver).
      const hash2 = await writeContractAsync({
        ...escrowContract,
        functionName: "executeTransaction",
        args: [transactionId],
      });
      toast.success("Completed.");
      const txExplorerUrl = getTxExplorerUrl(hash2, chainId);
      toast.message(
        txExplorerUrl ? (
          <a href={txExplorerUrl} target="_blank" rel="noreferrer" className="underline">
            Tx: {truncateHash(hash2)}
          </a>
        ) : (
          `Tx: ${hash2}`
        )
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Payment failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button size="sm" onClick={onClick} disabled={!isConnected || !onSepolia || loading}>
      {loading ? "Processing…" : "Pay and complete"}
    </Button>
  );
}

"use client";

import * as React from "react";
import { usePublicClient } from "wagmi";
import type { PublicClient } from "viem";
import { escrowContract, type EscrowTransaction } from "@/lib/marketplace/escrow";
import { decodeEventLog, type Address, parseAbiItem } from "viem";

type State =
  | { status: "idle"; data: EscrowTransaction[]; error: null }
  | { status: "loading"; data: EscrowTransaction[]; error: null }
  | { status: "error"; data: EscrowTransaction[]; error: string };

// Batched log fetching to avoid 50k block limit
async function fetchMetaEvidenceBatched(
  publicClient: PublicClient,
  ids: bigint[]
): Promise<Map<bigint, string>> {
  const map = new Map<bigint, string>();
  if (!ids.length) return map;

  const wanted = new Set(ids.map((x) => x.toString()));
  const head = await publicClient.getBlockNumber();
  const CHUNK_SIZE = 40000n;
  // Look back 200k blocks
  const startBlock = head > 200_000n ? head - 200_000n : 0n;

  for (let start = startBlock; start <= head; start += CHUNK_SIZE) {
    const end = start + CHUNK_SIZE > head ? head : start + CHUNK_SIZE;
    try {
      const logs = await publicClient.getLogs({
        address: escrowContract.address as Address,
        event: parseAbiItem("event MetaEvidence(uint256 indexed _metaEvidenceID, string _evidence)"),
        fromBlock: start,
        toBlock: end,
      });

      for (const log of logs) {
        try {
          const decoded = decodeEventLog({ abi: escrowContract.abi, data: log.data, topics: log.topics });
          if (decoded.eventName !== "MetaEvidence") continue;
          const metaEvidenceId = decoded.args._metaEvidenceID as bigint;
          if (!wanted.has(metaEvidenceId.toString())) continue;
          map.set(metaEvidenceId, decoded.args._evidence as string);
        } catch {
          // ignore
        }
      }
    } catch (e) {
      console.warn(`MetaEvidence fetch failed ${start}-${end}:`, e);
    }
  }

  return map;
}

export function useEscrowTransactions(address?: `0x${string}`) {
  const publicClient = usePublicClient();
  const [state, setState] = React.useState<State>({
    status: "idle",
    data: [],
    error: null,
  });

  React.useEffect(() => {
    let cancelled = false;
    async function run() {
      if (!address) {
        setState({ status: "idle", data: [], error: null });
        return;
      }
      if (!publicClient) {
        setState({ status: "error", data: [], error: "Public client not available" });
        return;
      }
      setState((s) => ({ ...s, status: "loading", error: null }));
      try {
        const ids = (await publicClient.readContract({
          ...escrowContract,
          functionName: "getTransactionIDsByAddress",
          args: [address],
        })) as bigint[];

        const uniqueIds = Array.from(new Set(ids.map((x) => x.toString()))).map((s) => BigInt(s));

        const txs = await Promise.all(
          uniqueIds.map(async (id) => {
            const t = (await publicClient.readContract({
              ...escrowContract,
              functionName: "transactions",
              args: [id],
            })) as readonly [Address, Address, bigint, bigint, bigint, bigint, bigint, bigint, number];

            const [sender, receiver, amount, timeoutPayment, disputeId, senderFee, receiverFee, lastInteraction, status] = t;

            return {
              id,
              sender: sender as `0x${string}`,
              receiver: receiver as `0x${string}`,
              amount,
              timeoutPayment,
              disputeId,
              senderFee,
              receiverFee,
              lastInteraction,
              status,
            } satisfies EscrowTransaction;
          })
        );

        const metaMap = await fetchMetaEvidenceBatched(publicClient, uniqueIds);
        const enriched = txs.map((t) => ({ ...t, metaEvidence: metaMap.get(t.id) }));

        if (!cancelled) setState({ status: "idle", data: enriched, error: null });
      } catch (e) {
        if (!cancelled)
          setState({
            status: "error",
            data: [],
            error: e instanceof Error ? e.message : "Failed to load escrows",
          });
      }
    }
    run();
    return () => { cancelled = true; };
  }, [address, publicClient]);

  return state;
}

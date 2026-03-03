"use client";

import * as React from "react";
import { usePublicClient } from "wagmi";
import type { PublicClient } from "viem";
import { parseAbiItem, type Address, decodeEventLog } from "viem";

import { escrowContract, type EscrowTransaction } from "@/lib/marketplace/escrow";
import { safeParseMeta, extractAgentId } from "@/lib/marketplace/meta";

export type AgentOffer = {
  transactionId: bigint;
  sender: `0x${string}`;
  receiver: `0x${string}`;
  amount: bigint;
  status: number;
  metaEvidence?: string;
};

type State =
  | { status: "idle"; data: AgentOffer[]; error: null }
  | { status: "loading"; data: AgentOffer[]; error: null }
  | { status: "error"; data: AgentOffer[]; error: string };

// Batched log fetching to avoid 50k block limit
async function fetchMetaEvidenceBatched(
  publicClient: PublicClient,
  agentId: string
): Promise<{ id: bigint; metaEvidence: string }[]> {
  const candidates: { id: bigint; metaEvidence: string }[] = [];
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
          const id = decoded.args._metaEvidenceID as bigint;
          const metaEvidence = decoded.args._evidence as string;
          const meta = safeParseMeta(metaEvidence);
          if (meta?.kind !== "erc8004-agent-offer") continue;
          const a = extractAgentId(meta);
          if (a !== agentId) continue;
          candidates.push({ id, metaEvidence });
        } catch {
          // ignore decode errors
        }
      }
    } catch (e) {
      console.warn(`MetaEvidence fetch failed ${start}-${end}:`, e);
    }
  }

  return candidates;
}

export function useOffersForAgent(agentId: string) {
  const publicClient = usePublicClient();
  const [state, setState] = React.useState<State>({ status: "idle", data: [], error: null });

  React.useEffect(() => {
    let cancelled = false;
    async function run() {
      if (!agentId) {
        setState({ status: "idle", data: [], error: null });
        return;
      }
      if (!publicClient) {
        setState({ status: "error", data: [], error: "Public client not available" });
        return;
      }

      setState((s) => ({ ...s, status: "loading", error: null }));
      try {
        // Fetch MetaEvidence logs in chunks to avoid 50k block limit
        const candidates = await fetchMetaEvidenceBatched(publicClient, agentId);

        const unique = Array.from(new Map(candidates.map((c) => [c.id.toString(), c])).values());
        const txs: AgentOffer[] = [];

        for (const c of unique.slice(-50)) {
          const t = (await publicClient.readContract({
            ...escrowContract,
            functionName: "transactions",
            args: [c.id],
          })) as unknown as readonly [
            Address,
            Address,
            bigint,
            bigint,
            bigint,
            bigint,
            bigint,
            bigint,
            number
          ];

          const [sender, receiver, amount, _timeoutPayment, _disputeId, _senderFee, _receiverFee, _lastInteraction, status] = t;

          txs.push({
            transactionId: c.id,
            sender: sender as `0x${string}`,
            receiver: receiver as `0x${string}`,
            amount,
            status,
            metaEvidence: c.metaEvidence,
          });
        }

        if (!cancelled) setState({ status: "idle", data: txs.sort((a, b) => Number(b.transactionId - a.transactionId)), error: null });
      } catch (e) {
        if (!cancelled)
          setState({ status: "error", data: [], error: e instanceof Error ? e.message : "Failed to load offers" });
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [agentId, publicClient]);

  return state;
}

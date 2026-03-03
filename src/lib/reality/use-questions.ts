"use client";

import * as React from "react";
import { usePublicClient } from "wagmi";
import { decodeEventLog, parseAbiItem, type Address, type PublicClient } from "viem";

import { REALITIO_ABI } from "@/lib/abi/realitio";
import { REALITY_PROXY_ADDRESS } from "@/lib/contracts/addresses";
import { useRealitioAddress } from "@/lib/reality/use-realitio-address";

export type RealityQuestionRow = {
  questionId: `0x${string}`;
  created: bigint;
  user: `0x${string}`;
  templateId: bigint;
  question: string;
  arbitrator: `0x${string}`;
  timeout: number;
  openingTs: number;
  bestAnswer?: `0x${string}`;
  bond?: bigint;
  minBond?: bigint;
  finalized?: boolean;
  finalizeTs?: number;
};

type State =
  | { status: "idle"; data: RealityQuestionRow[]; error: null }
  | { status: "loading"; data: RealityQuestionRow[]; error: null }
  | { status: "error"; data: RealityQuestionRow[]; error: string };

const LOG_NEW_QUESTION = parseAbiItem(
  "event LogNewQuestion(bytes32 indexed question_id, address indexed user, uint256 template_id, string question, bytes32 indexed content_hash, address arbitrator, uint32 timeout, uint32 opening_ts, uint256 nonce, uint256 created)"
);

type LogArgs = {
  question_id?: `0x${string}`;
  user?: `0x${string}`;
  template_id?: bigint;
  question?: string;
  arbitrator?: `0x${string}`;
  timeout?: number;
  opening_ts?: number;
  created?: bigint;
};

function toQuestion(args: LogArgs): RealityQuestionRow | null {
  if (!args.question_id) return null;
  if (!args.user) return null;
  if (args.template_id === undefined) return null;
  if (!args.question) return null;
  if (!args.arbitrator) return null;
  if (args.timeout === undefined) return null;
  if (args.opening_ts === undefined) return null;
  if (!args.created) return null;

  return {
    questionId: args.question_id,
    user: args.user,
    templateId: args.template_id,
    question: args.question,
    arbitrator: args.arbitrator,
    timeout: args.timeout,
    openingTs: args.opening_ts,
    created: args.created,
  };
}

function parseLogArgs(log: {
  args?: LogArgs;
  data: `0x${string}`;
  topics: readonly `0x${string}`[];
}): LogArgs | null {
  if (log.args) return log.args;

  try {
    if (!log.topics.length) return null;
    const decoded = decodeEventLog({
      abi: REALITIO_ABI,
      data: log.data,
      topics: log.topics as [`0x${string}`, ...`0x${string}`[]],
    });
    if (decoded.eventName !== "LogNewQuestion") return null;
    return (decoded.args as LogArgs) || null;
  } catch {
    return null;
  }
}

async function fetchAllLogs(
  publicClient: PublicClient,
  address: Address,
  fromBlock: bigint,
  toBlock: bigint
) {
  const chunkSize = 40_000n;
  const allLogs: Awaited<ReturnType<PublicClient["getLogs"]>> = [];

  for (let start = fromBlock; start <= toBlock; start += chunkSize) {
    const end = start + chunkSize > toBlock ? toBlock : start + chunkSize;
    try {
      const logs = await publicClient.getLogs({
        address,
        event: LOG_NEW_QUESTION,
        fromBlock: start,
        toBlock: end,
      });
      allLogs.push(...logs);
    } catch (error) {
      console.warn(`Failed to fetch logs ${start}-${end}:`, error);
    }
  }

  return allLogs;
}

export function useRealityQuestions() {
  const publicClient = usePublicClient();
  const realitio = useRealitioAddress();
  const [state, setState] = React.useState<State>({
    status: "idle",
    data: [],
    error: null,
  });

  React.useEffect(() => {
    let cancelled = false;
    async function run() {
      if (!publicClient) {
        setState({ status: "error", data: [], error: "Public client not available" });
        return;
      }
      if (realitio.status === "error") {
        setState({ status: "error", data: [], error: realitio.error });
        return;
      }
      if (realitio.status !== "idle" || !realitio.address) {
        setState({ status: "loading", data: [], error: null });
        return;
      }

      setState((s) => ({ ...s, status: "loading", error: null }));
      try {
        const head = await publicClient.getBlockNumber();

        const toRows = (logs: Awaited<ReturnType<PublicClient["getLogs"]>>) =>
          logs
            .map((log) => {
              const args = parseLogArgs(log as { args?: LogArgs; data: `0x${string}`; topics: readonly `0x${string}`[] });
              return toQuestion(args || {});
            })
            .filter((row): row is RealityQuestionRow => !!row)
            .filter((row) => row.arbitrator.toLowerCase() === REALITY_PROXY_ADDRESS.toLowerCase())
            .sort((a, b) => Number(b.created - a.created));

        const windows = [200_000n, 500_000n, 1_500_000n];
        let baseRows: RealityQuestionRow[] = [];

        for (const windowSize of windows) {
          const fromBlock = head > windowSize ? head - windowSize : 0n;
          const logs = await fetchAllLogs(publicClient, realitio.address as Address, fromBlock, head);
          baseRows = toRows(logs);
          if (baseRows.length > 0) {
            break;
          }
        }

        if (baseRows.length === 0) {
          if (!cancelled) {
            setState({ status: "idle", data: [], error: null });
          }
          return;
        }

        const toEnrich = baseRows.slice(0, 50);
        let enriched = baseRows;

        try {
          const calls = toEnrich.flatMap((q) => [
            { address: realitio.address, abi: REALITIO_ABI, functionName: "getBestAnswer", args: [q.questionId] },
            { address: realitio.address, abi: REALITIO_ABI, functionName: "getBond", args: [q.questionId] },
            { address: realitio.address, abi: REALITIO_ABI, functionName: "getMinBond", args: [q.questionId] },
            { address: realitio.address, abi: REALITIO_ABI, functionName: "isFinalized", args: [q.questionId] },
            { address: realitio.address, abi: REALITIO_ABI, functionName: "getFinalizeTS", args: [q.questionId] },
          ]);

          type ContractsArg = NonNullable<Parameters<PublicClient["multicall"]>[0]>["contracts"];
          const results = await publicClient.multicall({
            contracts: calls as ContractsArg,
            allowFailure: true,
          });

          const map = new Map<string, Partial<RealityQuestionRow>>();
          for (let i = 0; i < toEnrich.length; i++) {
            const offset = i * 5;
            map.set(toEnrich[i].questionId.toLowerCase(), {
              bestAnswer: results[offset + 0]?.result as `0x${string}` | undefined,
              bond: results[offset + 1]?.result as bigint | undefined,
              minBond: results[offset + 2]?.result as bigint | undefined,
              finalized: results[offset + 3]?.result as boolean | undefined,
              finalizeTs:
                results[offset + 4]?.result === undefined ? undefined : Number(results[offset + 4]?.result),
            });
          }

          enriched = baseRows.map((q) => ({ ...q, ...(map.get(q.questionId.toLowerCase()) || {}) }));
        } catch {
          // ignore enrichment failures
        }

        if (!cancelled) {
          setState({ status: "idle", data: enriched, error: null });
        }
      } catch (error) {
        if (!cancelled) {
          setState({
            status: "error",
            data: [],
            error: error instanceof Error ? error.message : "Failed to load questions",
          });
        }
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [publicClient, realitio.status, realitio.address, realitio.error]);

  return state;
}

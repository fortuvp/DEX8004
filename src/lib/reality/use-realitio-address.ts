"use client";

import * as React from "react";
import { usePublicClient } from "wagmi";
import { realityProxyContract } from "@/lib/reality/contracts";

export function useRealitioAddress() {
  const publicClient = usePublicClient();
  const [state, setState] = React.useState<
    | { status: "idle"; address: `0x${string}` | null; error: null }
    | { status: "loading"; address: `0x${string}` | null; error: null }
    | { status: "error"; address: null; error: string }
  >({ status: "idle", address: null, error: null });

  React.useEffect(() => {
    let cancelled = false;
    async function run() {
      if (!publicClient) {
        setState({ status: "error", address: null, error: "Public client not available" });
        return;
      }
      setState({ status: "loading", address: null, error: null });
      try {
        const addr = (await publicClient.readContract({
          ...realityProxyContract,
          functionName: "realitio",
        })) as `0x${string}`;
        if (!cancelled) setState({ status: "idle", address: addr, error: null });
      } catch (e) {
        if (!cancelled)
          setState({
            status: "error",
            address: null,
            error: e instanceof Error ? e.message : "Failed to load realitio address",
          });
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [publicClient]);

  return state;
}

"use client";

import * as React from "react";
import { toast } from "sonner";
import { useAccount, useChainId, usePublicClient, useWriteContract } from "wagmi";
import { sepolia } from "wagmi/chains";
import { isAddress, parseEther } from "viem";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

import { REALITIO_ABI } from "@/lib/abi/realitio";
import { REALITY_PROXY_ADDRESS } from "@/lib/contracts/addresses";
import { useRealitioAddress } from "@/lib/reality/use-realitio-address";
import { buildAbuseQuestionText, DEFAULT_TIMEOUT_SECONDS, REALITY_TEMPLATE_ID_BOOL } from "@/lib/reality/questions";
import { getAddressExplorerUrl, getTxExplorerUrl, truncateHash } from "@/lib/block-explorer";
import { AGENT_NETWORK_CHAIN_IDS, getAgentSubgraphLabel, type AgentSubgraphNetwork } from "@/lib/agent-networks";

export function ReportAbuseDialog(props: {
  agentId: string;
  agentName?: string;
  agentUri?: string | null;
  owner?: string;
  network?: AgentSubgraphNetwork;
}) {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();
  const realitio = useRealitioAddress();

  const [open, setOpen] = React.useState(false);
  const [description, setDescription] = React.useState("");
  const [evidence, setEvidence] = React.useState("");
  const [bondEth, setBondEth] = React.useState("0");
  const [submitting, setSubmitting] = React.useState(false);

  const onSepolia = chainId === sepolia.id;

  const evidenceUrls = React.useMemo(() => {
    return evidence
      .split(/\s+/)
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 5);
  }, [evidence]);

  async function onSubmit() {
    if (!isConnected || !address) {
      toast.error("Connect your wallet to report an abuse.");
      return;
    }
    if (!onSepolia) {
      toast.error("Switch to Sepolia.");
      return;
    }
    if (!publicClient) {
      toast.error("Public client not available.");
      return;
    }
    if (realitio.status !== "idle" || !realitio.address) {
      toast.error(realitio.status === "error" ? realitio.error : "Loading Realitio…");
      return;
    }

    const trimmed = description.trim();
    if (trimmed.length < 10) {
      toast.error("Please provide a short description (min 10 chars).");
      return;
    }

    const questionText = buildAbuseQuestionText({
      agentId: props.agentId,
      network: props.network,
      chainId: props.network ? `eip155:${AGENT_NETWORK_CHAIN_IDS[props.network]}` : undefined,
      agentName: props.agentName,
      agentUri: props.agentUri,
      owner: props.owner,
      reporter: address,
      description: trimmed,
      evidenceUrls,
    });

    // Realitio can require a question fee for a given arbitrator (our proxy).
    const questionFee = (await publicClient.readContract({
      address: realitio.address,
      abi: REALITIO_ABI,
      functionName: "arbitrator_question_fees",
      args: [REALITY_PROXY_ADDRESS],
    })) as bigint;

    let bondWei = 0n;
    try {
      bondWei = bondEth && bondEth !== "0" ? parseEther(bondEth as `${number}`) : 0n;
    } catch {
      toast.error("Invalid bond amount.");
      return;
    }

    // We add the bond as bounty on the question (simple UX). If you want strict bonding-on-answer only,
    // set bondWei to 0 and require bond on submitAnswer.
    const value = questionFee + bondWei;

    // nonce: client-side randomness
    const nonce = BigInt(Date.now());

    setSubmitting(true);
    try {
      const hash = await writeContractAsync({
        address: realitio.address,
        abi: REALITIO_ABI,
        functionName: "askQuestion",
        args: [
          REALITY_TEMPLATE_ID_BOOL,
          questionText,
          REALITY_PROXY_ADDRESS,
          DEFAULT_TIMEOUT_SECONDS,
          0,
          nonce,
        ],
        value,
      });
      toast.success("Reality question created.");
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
      setDescription("");
      setEvidence("");
      setBondEth("0");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to create question");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          Report an abuse
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Report an abuse (Reality.eth)</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="text-sm text-muted-foreground">
            This creates a YES/NO Reality question on Sepolia, linked to this agent.
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Label htmlFor="desc">What happened?</Label>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="cursor-help text-xs text-muted-foreground underline">tip</span>
                </TooltipTrigger>
                <TooltipContent>
                  Be specific: what the agent did, when, and why it’s harmful. Keep it factual.
                </TooltipContent>
              </Tooltip>
            </div>
            <Input
              id="desc"
              placeholder="Describe the abuse clearly…"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="evidence">Evidence URLs (optional)</Label>
            <Input
              id="evidence"
              placeholder="Paste links (separate with spaces)"
              value={evidence}
              onChange={(e) => setEvidence(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="bond">Bounty (optional, ETH)</Label>
            <Input
              id="bond"
              inputMode="decimal"
              placeholder="0"
              value={bondEth}
              onChange={(e) => setBondEth(e.target.value)}
            />
            <div className="text-xs text-muted-foreground">
              Optional incentive for answering; not required.
            </div>
          </div>

          <div className="rounded-md border border-border bg-muted/30 p-3 text-xs text-muted-foreground space-y-1">
            <div>Agent ID: <span className="font-mono">{props.agentId}</span></div>
            {props.network ? (
              <div>
                Chain: {getAgentSubgraphLabel(props.network)} ({`eip155:${AGENT_NETWORK_CHAIN_IDS[props.network]}`})
              </div>
            ) : null}
            {props.agentName ? <div>Name: {props.agentName}</div> : null}
            {props.agentUri ? <div className="truncate">URI: {props.agentUri}</div> : null}
            {props.owner && isAddress(props.owner) ? (
              <div>
                Owner:{" "}
                {(() => {
                  const ownerExplorerUrl = getAddressExplorerUrl(props.owner!, sepolia.id);
                  return ownerExplorerUrl ? (
                    <a
                      href={ownerExplorerUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="font-mono underline-offset-2 hover:underline"
                    >
                      {props.owner}
                    </a>
                  ) : (
                    <span className="font-mono">{props.owner}</span>
                  );
                })()}
              </div>
            ) : null}
          </div>

          <Button className="w-full" onClick={onSubmit} disabled={!isConnected || !onSepolia || submitting}>
            {submitting ? "Submitting…" : "Create Reality question"}
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

"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import type { Agent } from "@/types/agent";
import { truncateAddress, getDisplayName } from "@/lib/format";
import { computeAgentQualityScore } from "@/lib/quality-score";
import {
  getAgentChainLabel,
  type AgentSubgraphNetwork,
} from "@/lib/agent-networks";
import { WatchToggle } from "@/components/agents/watch-toggle";

export function AgentCompactRow({
  agent,
  network,
}: {
  agent: Agent;
  network: AgentSubgraphNetwork;
}) {
  const quality = computeAgentQualityScore(agent);

  return (
    <div className="flex items-center justify-between rounded-lg border border-border/40 bg-card/30 px-3 py-2">
      <div className="min-w-0">
        <div className="truncate text-sm font-medium">{getDisplayName(agent)}</div>
        <div className="text-xs text-muted-foreground">
          {getAgentChainLabel(agent.chainId, network)} • {truncateAddress(agent.owner)}
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Badge variant="outline" className="text-xs">
          Q{quality}
        </Badge>
        <WatchToggle agent={agent} network={network} size="icon" className="h-7 w-7" />
        <Link
          href={`/agents/${encodeURIComponent(agent.id)}?network=${network}`}
          className="text-xs font-medium text-primary hover:text-primary/80"
        >
          View
        </Link>
      </div>
    </div>
  );
}

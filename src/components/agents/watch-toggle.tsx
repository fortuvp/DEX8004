"use client";

import * as React from "react";
import { Star } from "lucide-react";
import { useAccount } from "wagmi";
import { Button } from "@/components/ui/button";
import type { Agent } from "@/types/agent";
import type { AgentSubgraphNetwork } from "@/lib/agent-networks";
import { isWatchlisted, toggleWatchlist } from "@/lib/watchlist";

export function WatchToggle({
  agent,
  network,
  size = "icon",
  className,
}: {
  agent: Agent;
  network: AgentSubgraphNetwork;
  size?: "icon" | "sm";
  className?: string;
}) {
  const [active, setActive] = React.useState(false);
  const { address } = useAccount();

  React.useEffect(() => {
    setActive(isWatchlisted(agent.id, network, address));
  }, [agent.id, network, address]);

  return (
    <Button
      type="button"
      variant={active ? "default" : "outline"}
      size={size}
      className={className}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        const next = toggleWatchlist(agent, network, 0, address);
        setActive(next);
      }}
      aria-label={active ? "Remove from watchlist" : "Add to watchlist"}
      title={active ? "Remove from watchlist" : "Add to watchlist"}
    >
      <Star className={`h-4 w-4 ${active ? "fill-current" : ""}`} />
    </Button>
  );
}

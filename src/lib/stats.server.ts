import "server-only";

import { getAgents } from "@/lib/subgraph.handler";
import { getDisplayName } from "@/lib/format";
import {
  AGENT_SUBGRAPH_NETWORKS,
  getAgentSubgraphLabel,
  type AgentSubgraphNetwork,
} from "@/lib/agent-networks";
import { computeAgentQualityScore } from "@/lib/quality-score";
import type { Agent } from "@/types/agent";

type AgentSnapshot = {
  id: string;
  agentId: string;
  name: string;
  network: AgentSubgraphNetwork;
  chainId: string;
  owner: string;
  createdAt: number;
  updatedAt: number;
  lastActivity: number;
  totalFeedback: number;
  quality: number;
  active: boolean;
  hasImage: boolean;
  x402Support: boolean;
  hasMcp: boolean;
  hasA2A: boolean;
  capabilities: string[];
};

type RankedAgent = {
  id: string;
  agentId: string;
  name: string;
  network: AgentSubgraphNetwork;
  chainId: string;
  owner: string;
  totalFeedback: number;
  quality: number;
  createdAt: number;
  updatedAt: number;
  lastActivity: number;
  score: number;
};

type ActivityItem = {
  kind: "created" | "updated" | "active";
  id: string;
  agentId: string;
  name: string;
  network: AgentSubgraphNetwork;
  chainId: string;
  timestamp: number;
};

export type DashboardStatsResponse = {
  generatedAt: string;
  sampleSize: number;
  selectedNetworks: AgentSubgraphNetwork[];
  stats: {
    totalAgents: number;
    active7d: number;
    networks: number;
    totalReviews: number;
    newLast24h: number;
    averageQuality: number;
  };
  networkBreakdown: Array<{
    network: AgentSubgraphNetwork;
    label: string;
    agents: number;
    active7d: number;
    new24h: number;
    reviews: number;
    averageQuality: number;
  }>;
  lists: {
    trending: RankedAgent[];
    topRated: RankedAgent[];
    mostReviewed: RankedAgent[];
    recentlyAdded: RankedAgent[];
    recentlyActive: RankedAgent[];
    qualityLeaders: RankedAgent[];
  };
  capabilityTop: Array<{ capability: string; count: number }>;
  activityPreview: ActivityItem[];
};

const DEFAULT_SAMPLE_SIZE = 12000;
const CACHE_TTL_MS = 90_000;

const dashboardCache = new Map<string, { expiresAt: number; data: DashboardStatsResponse }>();

function toUnix(value: string): number {
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function normalizeNetworks(networks?: AgentSubgraphNetwork[]): AgentSubgraphNetwork[] {
  const set = new Set(networks && networks.length ? networks : AGENT_SUBGRAPH_NETWORKS);
  return AGENT_SUBGRAPH_NETWORKS.filter((n) => set.has(n));
}

function buildCacheKey(sampleSize: number, networks: AgentSubgraphNetwork[]) {
  return `${sampleSize}:${networks.join(",")}`;
}

function toCapabilities(agent: Agent): string[] {
  const set = new Set<string>();
  for (const tool of agent.registrationFile?.mcpTools || []) {
    if (tool?.trim()) set.add(tool.trim().toLowerCase());
  }
  for (const skill of agent.registrationFile?.a2aSkills || []) {
    if (skill?.trim()) set.add(skill.trim().toLowerCase());
  }
  for (const trust of agent.registrationFile?.supportedTrusts || []) {
    if (trust?.trim()) set.add(trust.trim().toLowerCase());
  }
  return Array.from(set);
}

function toSnapshot(agent: Agent, network: AgentSubgraphNetwork): AgentSnapshot {
  const quality = computeAgentQualityScore(agent);
  return {
    id: agent.id,
    agentId: agent.agentId,
    name: getDisplayName(agent),
    network,
    chainId: agent.chainId,
    owner: agent.owner,
    createdAt: toUnix(agent.createdAt),
    updatedAt: toUnix(agent.updatedAt),
    lastActivity: toUnix(agent.lastActivity),
    totalFeedback: toUnix(agent.totalFeedback),
    quality,
    active: !!agent.registrationFile?.active,
    hasImage: !!agent.registrationFile?.image,
    x402Support: !!agent.registrationFile?.x402Support,
    hasMcp: !!agent.registrationFile?.mcpEndpoint,
    hasA2A: !!agent.registrationFile?.a2aEndpoint,
    capabilities: toCapabilities(agent),
  };
}

function rankFromSnapshot(a: AgentSnapshot, score: number): RankedAgent {
  return {
    id: a.id,
    agentId: a.agentId,
    name: a.name,
    network: a.network,
    chainId: a.chainId,
    owner: a.owner,
    totalFeedback: a.totalFeedback,
    quality: a.quality,
    createdAt: a.createdAt,
    updatedAt: a.updatedAt,
    lastActivity: a.lastActivity,
    score,
  };
}

async function loadAgentSample(sampleSize: number, networks: AgentSubgraphNetwork[]): Promise<AgentSnapshot[]> {
  const perNetwork = Math.max(500, Math.ceil(sampleSize / Math.max(networks.length, 1)));
  const collected: AgentSnapshot[] = [];

  async function collectByOrder(
    network: AgentSubgraphNetwork,
    target: number,
    orderBy: "createdAt" | "updatedAt" | "lastActivity" | "totalFeedback",
    out: AgentSnapshot[]
  ) {
    if (target <= 0) return;

    const pageSize = Math.min(1000, Math.max(200, target));
    let skip = 0;

    while (skip < target) {
      const first = Math.min(pageSize, target - skip);
      const items = await getAgents({
        first,
        skip,
        orderBy,
        orderDirection: "desc",
        network,
      });

      for (const agent of items) {
        out.push(toSnapshot(agent, network));
      }

      if (items.length < first) break;
      skip += first;
    }
  }

  await Promise.all(
    networks.map(async (network) => {
      try {
        const recentTarget = Math.max(200, Math.floor(perNetwork * 0.5));
        const activeTarget = Math.max(150, Math.floor(perNetwork * 0.25));
        const reviewedTarget = Math.max(150, perNetwork - recentTarget - activeTarget);

        const bucket: AgentSnapshot[] = [];
        await collectByOrder(network, recentTarget, "createdAt", bucket);
        await collectByOrder(network, activeTarget, "lastActivity", bucket);
        await collectByOrder(network, reviewedTarget, "totalFeedback", bucket);

        collected.push(...bucket);
      } catch {
        // Keep response available even with partial network failures.
      }
    })
  );

  const unique = new Map<string, AgentSnapshot>();
  for (const item of collected) {
    unique.set(`${item.network}:${item.id}`, item);
  }

  return Array.from(unique.values()).slice(0, sampleSize);
}

function computeCapabilityTop(sample: AgentSnapshot[]) {
  const counts = new Map<string, number>();
  for (const agent of sample) {
    for (const cap of agent.capabilities) {
      counts.set(cap, (counts.get(cap) || 0) + 1);
    }
  }
  return Array.from(counts.entries())
    .map(([capability, count]) => ({ capability, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 24);
}

async function computeDashboardData(sampleSize: number, selectedNetworks: AgentSubgraphNetwork[]) {
  const now = Math.floor(Date.now() / 1000);
  const last24h = now - 24 * 3600;
  const last7d = now - 7 * 24 * 3600;

  const sample = await loadAgentSample(sampleSize, selectedNetworks);

  const totalReviews = sample.reduce((sum, item) => sum + item.totalFeedback, 0);
  const newLast24h = sample.filter((item) => item.createdAt >= last24h).length;
  const active7d = sample.filter((item) => item.lastActivity >= last7d).length;
  const networkCount = new Set(sample.map((item) => item.network)).size;
  const averageQuality = sample.length
    ? Math.round(sample.reduce((sum, item) => sum + item.quality, 0) / sample.length)
    : 0;

  const networkBreakdown = selectedNetworks
    .map((network) => {
      const subset = sample.filter((item) => item.network === network);
      const avgQuality = subset.length
        ? Math.round(subset.reduce((sum, item) => sum + item.quality, 0) / subset.length)
        : 0;
      return {
        network,
        label: getAgentSubgraphLabel(network),
        agents: subset.length,
        active7d: subset.filter((item) => item.lastActivity >= last7d).length,
        new24h: subset.filter((item) => item.createdAt >= last24h).length,
        reviews: subset.reduce((sum, item) => sum + item.totalFeedback, 0),
        averageQuality: avgQuality,
      };
    })
    .filter((item) => item.agents > 0);

  const trending = sample
    .map((item) => {
      const activityBoost = item.lastActivity >= last7d ? 30 : 0;
      const freshnessBoost = item.createdAt >= last24h ? 20 : 0;
      const feedbackBoost = Math.min(35, item.totalFeedback * 2);
      const qualityBoost = Math.round(item.quality * 0.15);
      return rankFromSnapshot(item, activityBoost + freshnessBoost + feedbackBoost + qualityBoost);
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 20);

  const mostReviewed = sample
    .map((item) => rankFromSnapshot(item, item.totalFeedback))
    .sort((a, b) => b.totalFeedback - a.totalFeedback)
    .slice(0, 20);

  const topRated = sample
    .filter((item) => item.totalFeedback > 0 || item.quality >= 60)
    .map((item) => rankFromSnapshot(item, item.quality * 0.7 + Math.min(item.totalFeedback, 10) * 3))
    .sort((a, b) => b.score - a.score)
    .slice(0, 20);

  const qualityLeaders = sample
    .map((item) => rankFromSnapshot(item, item.quality))
    .sort((a, b) => b.quality - a.quality)
    .slice(0, 20);

  const recentlyAdded = sample
    .map((item) => rankFromSnapshot(item, item.createdAt))
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 20);

  const recentlyActive = sample
    .map((item) => rankFromSnapshot(item, item.lastActivity))
    .sort((a, b) => b.lastActivity - a.lastActivity)
    .slice(0, 20);

  const activityPreview = sample
    .flatMap((item) => [
      {
        kind: "created" as const,
        id: item.id,
        agentId: item.agentId,
        name: item.name,
        network: item.network,
        chainId: item.chainId,
        timestamp: item.createdAt,
      },
      {
        kind: "updated" as const,
        id: item.id,
        agentId: item.agentId,
        name: item.name,
        network: item.network,
        chainId: item.chainId,
        timestamp: item.updatedAt,
      },
      {
        kind: "active" as const,
        id: item.id,
        agentId: item.agentId,
        name: item.name,
        network: item.network,
        chainId: item.chainId,
        timestamp: item.lastActivity,
      },
    ])
    .filter((item) => item.timestamp > 0)
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, 120);

  return {
    generatedAt: new Date().toISOString(),
    sampleSize: sample.length,
    selectedNetworks,
    stats: {
      totalAgents: sample.length,
      active7d,
      networks: networkCount,
      totalReviews,
      newLast24h,
      averageQuality,
    },
    networkBreakdown,
    lists: {
      trending,
      topRated,
      mostReviewed,
      recentlyAdded,
      recentlyActive,
      qualityLeaders,
    },
    capabilityTop: computeCapabilityTop(sample),
    activityPreview,
  } satisfies DashboardStatsResponse;
}

export async function getDashboardStats(options?: {
  sampleSize?: number;
  networks?: AgentSubgraphNetwork[];
}) {
  const sampleSize = options?.sampleSize ?? DEFAULT_SAMPLE_SIZE;
  const networks = normalizeNetworks(options?.networks);
  const key = buildCacheKey(sampleSize, networks);

  const cached = dashboardCache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }

  const data = await computeDashboardData(sampleSize, networks);
  dashboardCache.set(key, { data, expiresAt: Date.now() + CACHE_TTL_MS });
  return data;
}

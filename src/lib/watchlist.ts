"use client";

import type { Agent } from "@/types/agent";
import type { AgentSubgraphNetwork } from "@/lib/agent-networks";
import { getDisplayName } from "@/lib/format";
import { computeAgentQualityScore } from "@/lib/quality-score";

const WATCHLIST_KEY_PREFIX = "agents:watchlist:v2:";

export type WatchSnapshot = {
  quality: number;
  totalFeedback: number;
  totalValidations: number;
  updatedAt: string;
  lastActivity: string;
};

export type WatchlistItem = {
  key: string;
  id: string;
  agentId: string;
  network: AgentSubgraphNetwork;
  name: string;
  starredAt: number;
  snapshot: WatchSnapshot;
};

function toInt(value?: string | null) {
  if (!value) return 0;
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function normalizeScope(address?: string | null) {
  const trimmed = (address || "").trim().toLowerCase();
  return trimmed || "guest";
}

function makeStorageKey(scope?: string | null) {
  return `${WATCHLIST_KEY_PREFIX}${normalizeScope(scope)}`;
}

function makeKey(id: string, network: AgentSubgraphNetwork) {
  return `${network}:${id}`;
}

function readStore(scope?: string | null): WatchlistItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(makeStorageKey(scope));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as WatchlistItem[]) : [];
  } catch {
    return [];
  }
}

function writeStore(items: WatchlistItem[], scope?: string | null) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(makeStorageKey(scope), JSON.stringify(items.slice(0, 500)));
}

export function listWatchlist(scope?: string | null) {
  return readStore(scope).sort((a, b) => b.starredAt - a.starredAt);
}

export function isWatchlisted(id: string, network: AgentSubgraphNetwork, scope?: string | null) {
  return readStore(scope).some((item) => item.key === makeKey(id, network));
}

export function buildSnapshot(agent: Agent, totalValidations = 0): WatchSnapshot {
  return {
    quality: computeAgentQualityScore(agent),
    totalFeedback: toInt(agent.totalFeedback),
    totalValidations,
    updatedAt: agent.updatedAt,
    lastActivity: agent.lastActivity,
  };
}

export function toggleWatchlist(
  agent: Agent,
  network: AgentSubgraphNetwork,
  totalValidations = 0,
  scope?: string | null
) {
  const key = makeKey(agent.id, network);
  const current = readStore(scope);
  const exists = current.some((item) => item.key === key);

  if (exists) {
    writeStore(
      current.filter((item) => item.key !== key),
      scope
    );
    return false;
  }

  const next: WatchlistItem = {
    key,
    id: agent.id,
    agentId: agent.agentId,
    network,
    name: getDisplayName(agent),
    starredAt: Date.now(),
    snapshot: buildSnapshot(agent, totalValidations),
  };

  writeStore([next, ...current], scope);
  return true;
}

export function refreshWatchSnapshot(
  id: string,
  network: AgentSubgraphNetwork,
  snapshot: WatchSnapshot,
  scope?: string | null
) {
  const key = makeKey(id, network);
  const current = readStore(scope);
  const idx = current.findIndex((item) => item.key === key);
  if (idx < 0) return;
  current[idx] = { ...current[idx], snapshot };
  writeStore(current, scope);
}

export function diffSnapshot(previous: WatchSnapshot, next: WatchSnapshot) {
  const changes: string[] = [];
  if (previous.quality !== next.quality) changes.push(`quality ${previous.quality} -> ${next.quality}`);
  if (previous.totalFeedback !== next.totalFeedback) changes.push(`reviews ${previous.totalFeedback} -> ${next.totalFeedback}`);
  if (previous.totalValidations !== next.totalValidations) changes.push(`validations ${previous.totalValidations} -> ${next.totalValidations}`);
  if (previous.lastActivity !== next.lastActivity) changes.push("lastActivity changed");
  if (previous.updatedAt !== next.updatedAt) changes.push("updatedAt changed");
  return changes;
}


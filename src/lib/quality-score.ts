import type { Agent } from "@/types/agent";

export type QualityBreakdown = {
  score: number;
  completenessPercent: number;
  signals: string[];
  missing: string[];
};

type RegistrationLike = {
  name?: string | null;
  description?: string | null;
  image?: string | null;
  active?: boolean | null;
  x402Support?: boolean | null;
  mcpEndpoint?: string | null;
  mcpVersion?: string | null;
  mcpTools?: string[] | null;
  a2aEndpoint?: string | null;
  a2aVersion?: string | null;
  a2aSkills?: string[] | null;
  ens?: string | null;
  did?: string | null;
};

export function extractAgentCapabilities(agent: Agent): string[] {
  const rf = agent.registrationFile;
  if (!rf) return [];

  const capabilities = new Set<string>();
  for (const tool of rf.mcpTools || []) {
    if (tool?.trim()) capabilities.add(tool.trim().toLowerCase());
  }
  for (const skill of rf.a2aSkills || []) {
    if (skill?.trim()) capabilities.add(skill.trim().toLowerCase());
  }
  for (const trust of rf.supportedTrusts || []) {
    if (trust?.trim()) capabilities.add(trust.trim().toLowerCase());
  }

  return Array.from(capabilities);
}

function scoreRegistration(rf: RegistrationLike | null | undefined): QualityBreakdown {
  if (!rf) {
    return { score: 0, completenessPercent: 0, signals: [], missing: ["metadata"] };
  }

  const signals: string[] = [];
  const missing: string[] = [];
  let score = 0;
  let completenessCount = 0;

  const checks: Array<{ ok: boolean; key: string; weight: number }> = [
    { ok: !!rf.name, key: "name", weight: 12 },
    { ok: !!rf.description, key: "description", weight: 15 },
    { ok: !!rf.image, key: "image", weight: 8 },
    { ok: rf.active === true, key: "active", weight: 8 },
    { ok: !!rf.mcpEndpoint, key: "mcp endpoint", weight: 12 },
    { ok: !!rf.mcpVersion, key: "mcp version", weight: 6 },
    { ok: !!(rf.mcpTools && rf.mcpTools.length > 0), key: "mcp tools", weight: 6 },
    { ok: !!rf.a2aEndpoint, key: "a2a endpoint", weight: 12 },
    { ok: !!rf.a2aVersion, key: "a2a version", weight: 6 },
    { ok: !!(rf.a2aSkills && rf.a2aSkills.length > 0), key: "a2a skills", weight: 6 },
    { ok: rf.x402Support === true, key: "x402 support", weight: 6 },
    { ok: !!rf.ens || !!rf.did, key: "ens/did", weight: 3 },
  ];

  for (const check of checks) {
    if (check.ok) {
      score += check.weight;
      completenessCount += 1;
      signals.push(check.key);
    } else {
      missing.push(check.key);
    }
  }

  return {
    score: Math.min(100, score),
    completenessPercent: Math.round((completenessCount / checks.length) * 100),
    signals,
    missing,
  };
}

export function getAgentQualityBreakdown(agent: Agent): QualityBreakdown {
  return scoreRegistration(agent.registrationFile);
}

export function computeAgentQualityScore(agent: Agent): number {
  return getAgentQualityBreakdown(agent).score;
}

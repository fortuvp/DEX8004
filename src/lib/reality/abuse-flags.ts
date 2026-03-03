const KEY = "reality:abuseFlags:v1";

export type AbuseFlag = {
  agentId: string;
  questionId: `0x${string}`;
  flaggedAt: number;
};

function load(): AbuseFlag[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as AbuseFlag[]) : [];
  } catch {
    return [];
  }
}

function save(flags: AbuseFlag[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(flags));
}

export function isAgentFlagged(agentId: string) {
  return load().some((f) => f.agentId === agentId);
}

export function getFlagsForAgent(agentId: string): AbuseFlag[] {
  return load()
    .filter((f) => f.agentId === agentId)
    .sort((a, b) => b.flaggedAt - a.flaggedAt);
}

export function flagAgent(agentId: string, questionId: `0x${string}`) {
  const all = load();
  if (all.some((f) => f.agentId === agentId && f.questionId === questionId)) return;
  save([{ agentId, questionId, flaggedAt: Date.now() }, ...all].slice(0, 200));
}

export function parseAgentIdFromQuestionText(text: string): string | null {
  const patterns = [
    /AgentId:\s*([^\n\r]+)/i,
    /Agent\s*ID:\s*([^\n\r]+)/i,
    /Key0:\s*([^\n\r]+)/i,
    /"agentId"\s*:\s*"([^"]+)"/i,
    /"key0"\s*:\s*"([^"]+)"/i,
    /\bagentId\s*[:=]\s*([^\s,;]+)/i,
    /\bkey0\s*[:=]\s*([^\s,;]+)/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    const value = match?.[1]?.trim();
    if (value) return value;
  }

  return null;
}

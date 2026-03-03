export function safeParseMeta(meta?: string | null): any | null {
  if (!meta) return null;
  try {
    return JSON.parse(meta);
  } catch {
    return null;
  }
}

export function extractAgentId(meta?: any): string | null {
  if (!meta || typeof meta !== "object") return null;
  const v = (meta as any).agentId;
  return typeof v === "string" ? v : null;
}

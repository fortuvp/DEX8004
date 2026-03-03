export type CurateMode = "gtcr" | "pgtcr";

export function getCurateMode(): CurateMode {
  const raw = requireEnv("CURATE_MODE").toLowerCase();
  if (raw === "gtcr" || raw === "pgtcr") return raw;
  throw new Error(`Invalid CURATE_MODE: ${process.env.CURATE_MODE}`);
}

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var ${name}`);
  return v;
}

export function getCurateSubgraphUrl(mode = getCurateMode()): string {
  if (mode === "gtcr") {
    return requireEnv("ENVIO_SUBGRAPH_URL");
  }
  return requireEnv("PGTCR_GOLDSKY_SUBGRAPH_URL");
}

export function getCurateRegistryAddress(mode = getCurateMode()): string {
  if (mode === "gtcr") return requireEnv("GTCR_REGISTRY_ADDRESS");
  return requireEnv("PGTCR_REGISTRY_ADDRESS");
}

export function getGoldskyApiKey(): string | undefined {
  return process.env.GOLDSKY_API_KEY;
}

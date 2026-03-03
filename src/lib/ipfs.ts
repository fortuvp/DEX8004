"use client";

const DEFAULT_COURT_FUNCTIONS_URL = "https://kleros-api.netlify.app";

export function getCourtFunctionsUrl(): string {
  return (process.env.NEXT_PUBLIC_COURT_FUNCTIONS_URL || DEFAULT_COURT_FUNCTIONS_URL).replace(/\/$/, "");
}

export async function uploadJsonToIpfs(
  json: unknown,
  options?: { operation?: "item" | "evidence"; pinToGraph?: boolean; filename?: string }
): Promise<string> {
  const operation = options?.operation || "evidence";
  const pinToGraph = options?.pinToGraph ?? false;
  const filename = options?.filename || (operation === "item" ? "item.json" : "evidence.json");

  const url = `${getCourtFunctionsUrl()}/.netlify/functions/upload-to-ipfs?operation=${encodeURIComponent(operation)}&pinToGraph=${
    pinToGraph ? "true" : "false"
  }`;

  const blob = new Blob([JSON.stringify(json)], { type: "application/json" });
  const form = new FormData();
  form.append("file", blob, filename);

  const res = await fetch(url, {
    method: "POST",
    body: form,
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`IPFS upload failed (${res.status}): ${body || res.statusText}`);
  }

  const data = (await res.json()) as { cids?: string[] };
  const cid = data?.cids?.[0];
  if (!cid) throw new Error("IPFS upload returned no CID");

  // Curate expects /ipfs/<CID>
  return cid.startsWith("/ipfs/") ? cid : `/ipfs/${cid}`;
}

export async function uploadFileToIpfs(
  file: File,
  options?: { operation?: "item" | "evidence"; pinToGraph?: boolean }
): Promise<string> {
  const operation = options?.operation || "evidence";
  const pinToGraph = options?.pinToGraph ?? false;

  const url = `${getCourtFunctionsUrl()}/.netlify/functions/upload-to-ipfs?operation=${encodeURIComponent(operation)}&pinToGraph=${
    pinToGraph ? "true" : "false"
  }`;

  const form = new FormData();
  form.append("file", file, file.name || "upload");

  const res = await fetch(url, { method: "POST", body: form });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`IPFS upload failed (${res.status}): ${body || res.statusText}`);
  }
  const data = (await res.json()) as { cids?: string[] };
  const cid = data?.cids?.[0];
  if (!cid) throw new Error("IPFS upload returned no CID");
  return cid.startsWith("/ipfs/") ? cid : `/ipfs/${cid}`;
}

export function ipfsToGatewayUrl(uri: string): string {
  const trimmed = uri.trim();
  if (!trimmed) return trimmed;
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) return trimmed;

  // Prefer the CDN gateway for user-facing links (policy PDFs, evidence attachments, etc.)
  // as it tends to behave better for large files.
  if (trimmed.startsWith("ipfs://")) return `https://cdn.kleros.link/ipfs/${trimmed.slice("ipfs://".length)}`;
  if (trimmed.startsWith("/ipfs/")) return `https://cdn.kleros.link${trimmed}`;

  return trimmed;
}

export async function fetchIpfsJson<T>(uri: string): Promise<T> {
  const url = ipfsToGatewayUrl(uri);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch ${uri}`);
  return (await res.json()) as T;
}

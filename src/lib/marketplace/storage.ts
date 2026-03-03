import type { SaleRequest } from "@/lib/marketplace/types";

const KEY = "marketplace:saleRequests:v1";

function safeJsonParse<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function loadSaleRequests(): SaleRequest[] {
  if (typeof window === "undefined") return [];
  const parsed = safeJsonParse<SaleRequest[]>(window.localStorage.getItem(KEY));
  return Array.isArray(parsed) ? parsed : [];
}

export function saveSaleRequests(reqs: SaleRequest[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(reqs));
}

export function upsertSaleRequest(req: SaleRequest) {
  const all = loadSaleRequests();
  const next = [req, ...all.filter((r) => r.id !== req.id)];
  saveSaleRequests(next);
}

export function removeSaleRequest(id: string) {
  const all = loadSaleRequests();
  saveSaleRequests(all.filter((r) => r.id !== id));
}

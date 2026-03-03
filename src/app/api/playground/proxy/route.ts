import { NextRequest, NextResponse } from "next/server";
import dns from "node:dns/promises";
import net from "node:net";

const MAX_BODY_BYTES = 256_000;
const MAX_RESPONSE_BYTES = 1_000_000;
const FETCH_TIMEOUT_MS = 5_000;

function isPrivateIpv4(ip: string) {
  const parts = ip.split(".").map((p) => Number.parseInt(p, 10));
  if (parts.length !== 4 || parts.some((v) => Number.isNaN(v))) return true;
  const [a, b] = parts;
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 0) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  return false;
}

function isPrivateIpv6(ip: string) {
  const lower = ip.toLowerCase();
  return lower === "::1" || lower.startsWith("fc") || lower.startsWith("fd") || lower.startsWith("fe80");
}

async function assertSafeUrl(raw: string) {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error("Invalid URL");
  }

  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error("Only http/https are allowed");
  }

  const hostname = parsed.hostname.toLowerCase();
  if (hostname === "localhost" || hostname.endsWith(".local")) {
    throw new Error("Blocked hostname");
  }

  if (net.isIP(hostname)) {
    if ((net.isIPv4(hostname) && isPrivateIpv4(hostname)) || (net.isIPv6(hostname) && isPrivateIpv6(hostname))) {
      throw new Error("Blocked private IP");
    }
    return parsed;
  }

  const records = await dns.lookup(hostname, { all: true });
  if (!records.length) throw new Error("Could not resolve hostname");
  for (const record of records) {
    if (
      (record.family === 4 && isPrivateIpv4(record.address)) ||
      (record.family === 6 && isPrivateIpv6(record.address))
    ) {
      throw new Error("Blocked private IP target");
    }
  }
  return parsed;
}

async function readLimitedBody(stream: ReadableStream<Uint8Array> | null, maxBytes: number) {
  if (!stream) return "";
  const reader = stream.getReader();
  let bytes = 0;
  const chunks: Uint8Array[] = [];

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    bytes += value.byteLength;
    if (bytes > maxBytes) {
      await reader.cancel();
      throw new Error("Response too large");
    }
    chunks.push(value);
  }

  const merged = new Uint8Array(bytes);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(merged);
}

export async function POST(request: NextRequest) {
  if (process.env.FEATURE_PLAYGROUND !== "1") {
    return NextResponse.json(
      { success: false, error: "FEATURE_PLAYGROUND is disabled. Set FEATURE_PLAYGROUND=1 to enable." },
      { status: 403 }
    );
  }

  let payload: {
    url?: string;
    method?: string;
    headers?: Record<string, string>;
    body?: string;
  };
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
  }

  if (!payload.url) {
    return NextResponse.json({ success: false, error: "Missing url" }, { status: 400 });
  }

  try {
    const parsed = await assertSafeUrl(payload.url);
    const method = (payload.method || "GET").toUpperCase();
    const body = payload.body || "";
    if (body.length > MAX_BODY_BYTES) {
      return NextResponse.json({ success: false, error: "Request body too large" }, { status: 400 });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    let response: Response;
    try {
      response = await fetch(parsed.toString(), {
        method,
        headers: payload.headers || {},
        body: method === "GET" || method === "HEAD" ? undefined : body,
        signal: controller.signal,
        redirect: "follow",
      });
    } finally {
      clearTimeout(timeout);
    }

    const contentType = response.headers.get("content-type") || "";
    const text = await readLimitedBody(response.body, MAX_RESPONSE_BYTES);

    let json: unknown = null;
    if (contentType.includes("application/json")) {
      try {
        json = JSON.parse(text);
      } catch {
        json = null;
      }
    }

    const x402Signal = response.status === 402;
    const paymentHeaders = {
      "www-authenticate": response.headers.get("www-authenticate"),
      "x-payment-required": response.headers.get("x-payment-required"),
      "x-pay-request": response.headers.get("x-pay-request"),
    };

    return NextResponse.json({
      success: true,
      request: {
        url: parsed.toString(),
        method,
      },
      response: {
        status: response.status,
        ok: response.ok,
        contentType,
        headers: {
          "cache-control": response.headers.get("cache-control"),
          "content-type": contentType,
          "www-authenticate": paymentHeaders["www-authenticate"],
        },
        bodyText: text,
        bodyJson: json,
      },
      x402: {
        detected: x402Signal,
        paymentHeaders,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Proxy request failed" },
      { status: 400 }
    );
  }
}


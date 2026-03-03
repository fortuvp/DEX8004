"use client";

import * as React from "react";
import { FlaskConical, Loader2, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type ProxyResponse = {
  success: boolean;
  error?: string;
  request?: { url: string; method: string };
  response?: {
    status: number;
    ok: boolean;
    contentType: string;
    bodyText: string;
    bodyJson: unknown;
  };
  x402?: {
    detected: boolean;
    paymentHeaders: Record<string, string | null>;
  };
};

export default function PlaygroundPage() {
  const [url, setUrl] = React.useState("");
  const [method, setMethod] = React.useState("GET");
  const [body, setBody] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [result, setResult] = React.useState<ProxyResponse | null>(null);

  async function run() {
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/playground/proxy", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url, method, body }),
      });
      const json = (await res.json()) as ProxyResponse;
      setResult(json);
    } catch {
      setResult({ success: false, error: "Failed to execute request" });
    } finally {
      setLoading(false);
    }
  }

  const curl = `curl -i -X ${method} "${url}"${body && method !== "GET" ? ` -d '${body.replace(/'/g, "'\\''")}'` : ""}`;

  return (
    <div className="container mx-auto max-w-5xl px-6 py-10">
      <div className="mb-8">
        <div className="mb-2 flex items-center gap-3">
          <FlaskConical className="h-6 w-6 text-primary" />
          <h1 className="text-3xl font-bold tracking-tight">Agent Playground</h1>
        </div>
        <p className="text-muted-foreground">
          Endpoint tester behind a server proxy with SSRF guardrails, 5s timeout, and response-size limits.
        </p>
      </div>

      <section className="rounded-xl border border-border/50 bg-card/40 p-4">
        <div className="grid gap-3 sm:grid-cols-[120px_1fr]">
          <select
            value={method}
            onChange={(e) => setMethod(e.target.value)}
            className="h-11 rounded-lg border border-border/50 bg-background px-3 text-sm"
          >
            <option>GET</option>
            <option>POST</option>
            <option>PUT</option>
            <option>PATCH</option>
          </select>
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com/endpoint"
            className="h-11 rounded-lg border border-border/50 bg-background px-3 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>

        {method !== "GET" ? (
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder='{"input":"hello"}'
            className="mt-3 h-36 w-full rounded-lg border border-border/50 bg-background p-3 font-mono text-xs"
          />
        ) : null}

        <div className="mt-3 flex gap-2">
          <Button onClick={run} disabled={loading || !url.trim()}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Running
              </>
            ) : (
              "Run request"
            )}
          </Button>
          <Button
            variant="outline"
            onClick={() => navigator.clipboard.writeText(curl)}
            disabled={!url.trim()}
          >
            <Copy className="mr-2 h-4 w-4" />
            Copy curl
          </Button>
        </div>
      </section>

      {result ? (
        <section className="mt-6 rounded-xl border border-border/50 bg-card/40 p-4">
          {!result.success ? (
            <div className="text-sm text-red-300">{result.error || "Request failed"}</div>
          ) : (
            <>
              <div className="mb-3 flex items-center gap-2">
                <Badge variant="outline">Status {result.response?.status}</Badge>
                <Badge variant="outline">Content-Type {result.response?.contentType || "-"}</Badge>
                {result.x402?.detected ? (
                  <Badge className="border-amber-500/30 bg-amber-500/10 text-amber-300">x402 detected</Badge>
                ) : null}
              </div>

              {result.x402?.detected ? (
                <div className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
                  <div className="text-sm font-medium text-amber-200">x402 inspector</div>
                  <pre className="mt-2 overflow-x-auto text-xs text-amber-100">
                    {JSON.stringify(result.x402.paymentHeaders, null, 2)}
                  </pre>
                </div>
              ) : null}

              <pre className="max-h-[420px] overflow-auto rounded-lg border border-border/40 bg-background p-3 text-xs">
                {result.response?.bodyJson
                  ? JSON.stringify(result.response.bodyJson, null, 2)
                  : result.response?.bodyText || ""}
              </pre>
            </>
          )}
        </section>
      ) : null}
    </div>
  );
}


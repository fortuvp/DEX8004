import { Calculator } from "lucide-react";

export default function ScoringPage() {
  return (
    <div className="container mx-auto max-w-4xl px-6 py-10">
      <div className="mb-8">
        <div className="mb-2 flex items-center gap-3">
          <Calculator className="h-6 w-6 text-primary" />
          <h1 className="text-3xl font-bold tracking-tight">Transparent Scoring</h1>
        </div>
        <p className="text-muted-foreground">
          This page explains how quality, trending, and leaderboard ranks are computed in the explorer.
        </p>
      </div>

      <div className="space-y-4">
        <Card
          title="Quality score (0-100)"
          formula="Sum of weighted metadata signals: name (12), description (15), image (8), active (8), MCP endpoint (12), MCP version (6), MCP tools (6), A2A endpoint (12), A2A version (6), A2A skills (6), x402 (6), ENS/DID (3)."
          notes="Used in cards, trust filters, and quality leaderboard."
        />
        <Card
          title="Trending score"
          formula="Activity boost (30 if active in last 7d) + freshness boost (20 if created in last 24h) + feedback boost (min(35, totalFeedback*2)) + quality boost (quality*0.15)."
          notes="Used for the home trending list and leaderboard trending tab."
        />
        <Card
          title="Top rated score"
          formula="quality*0.7 + min(totalFeedback,10)*3."
          notes="Balances metadata quality and observed review volume."
        />
        <Card
          title="Most reviewed"
          formula="Sorted by totalFeedback descending."
          notes="Pure volume ranking."
        />
        <Card
          title="Recently active / recently added"
          formula="Sorted by lastActivity or createdAt descending."
          notes="Pure recency ranking."
        />
      </div>
    </div>
  );
}

function Card({ title, formula, notes }: { title: string; formula: string; notes: string }) {
  return (
    <section className="rounded-xl border border-border/50 bg-card/40 p-4">
      <h2 className="font-semibold">{title}</h2>
      <p className="mt-2 text-sm">{formula}</p>
      <p className="mt-2 text-xs text-muted-foreground">{notes}</p>
    </section>
  );
}


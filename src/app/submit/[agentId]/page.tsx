"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useParams } from "next/navigation";
import { ArrowLeft, FilePenLine } from "lucide-react";
import { CollateralizeAgentForm } from "@/components/pgtcr/collateralize-agent-form";

export default function SubmitAgentPage() {
  const params = useParams<{ agentId: string }>();
  const rawAgentId = params?.agentId || "";
  const agentId = useMemo(() => decodeURIComponent(rawAgentId), [rawAgentId]);

  if (!agentId) {
    return (
      <div className="container mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <Link href="/verified" className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
          Back
        </Link>
        <div className="rounded-xl border border-border/50 bg-card/40 p-6">
          <h1 className="text-xl font-semibold">Missing Agent ID</h1>
          <p className="mt-2 text-sm text-muted-foreground">Open this page with a valid agent id in the URL.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <Link href="/verified" className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" />
        Back
      </Link>

      <div className="rounded-xl border border-border/50 bg-card/40 p-6">
        <div className="mb-5">
          <div className="mb-2 flex items-center gap-2">
            <FilePenLine className="h-5 w-5 text-primary" />
            <h1 className="text-2xl font-semibold tracking-tight">Submit Agent</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Dedicated submission flow for agent <span className="font-mono">{agentId}</span>.
          </p>
        </div>

        <CollateralizeAgentForm agentId={agentId} />
      </div>
    </div>
  );
}


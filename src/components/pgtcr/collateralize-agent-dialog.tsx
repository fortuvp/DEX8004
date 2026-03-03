"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CollateralizeAgentForm } from "@/components/pgtcr/collateralize-agent-form";

export function CollateralizeAgentDialog(props: {
  agentId: string;
  trigger?: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [isMobileViewport, setIsMobileViewport] = React.useState(false);

  const submissionPageHref = `/submit/${encodeURIComponent(props.agentId)}`;

  React.useEffect(() => {
    const query = window.matchMedia("(max-width: 768px)");
    const update = () => setIsMobileViewport(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  const handleOpenChange = React.useCallback(
    (nextOpen: boolean) => {
      if (nextOpen && isMobileViewport) {
        router.push(submissionPageHref);
        return;
      }
      setOpen(nextOpen);
    },
    [isMobileViewport, router, submissionPageHref]
  );

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{props.trigger || <Button size="sm">Collateralize Agent</Button>}</DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Collateralize Agent (PGTCR)</DialogTitle>
        </DialogHeader>
        <CollateralizeAgentForm
          agentId={props.agentId}
          showNewPageLink
          newPageHref={submissionPageHref}
          onSubmitted={() => setOpen(false)}
          onCancel={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
}


"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

export function DialogContent(
  props: React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
) {
  const { className, children, ...rest } = props;
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/50" />
      <DialogPrimitive.Content
        className={
          "fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-h-[85vh] max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-lg border border-border bg-background p-6 shadow-lg " +
          (className || "")
        }
        {...rest}
      >
        {children}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

export function DialogHeader({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={"mb-4 " + (className || "")} {...props} />;
}

export function DialogTitle(
  props: React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
) {
  const { className, ...rest } = props;
  return (
    <DialogPrimitive.Title
      className={"text-lg font-semibold " + (className || "")}
      {...rest}
    />
  );
}

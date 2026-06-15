"use client";

import type { ReactNode } from "react";
import { Dialog } from "@/components/retroui/Dialog";
import { cn } from "@/lib/utils";

interface MobileSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: ReactNode;
}

export function MobileSheet({
  open,
  onOpenChange,
  title,
  children,
}: MobileSheetProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <Dialog.Content
        size="screen"
        className={cn(
          "left-0 top-auto bottom-0 max-w-lg translate-x-0 translate-y-0",
          "rounded-t-lg rounded-b-none border-b-0",
          "data-[open]:slide-in-from-bottom data-[closed]:slide-out-to-bottom",
          "max-h-[90dvh] overflow-y-auto",
        )}
        overlay={{ variant: "default" }}
      >
        <Dialog.Header>{title}</Dialog.Header>
        <div className="p-4">{children}</div>
      </Dialog.Content>
    </Dialog>
  );
}

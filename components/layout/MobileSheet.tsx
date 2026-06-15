"use client";

import type { ReactNode } from "react";
import { X } from "lucide-react";
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
  if (!open) {
    return null;
  }

  return (
    <div
      className={cn(
        "fixed inset-0 z-50 flex justify-center",
        "items-end md:items-center md:p-4",
      )}
    >
      <button
        type="button"
        aria-label="Close"
        className="absolute inset-0 bg-black/85"
        onClick={() => onOpenChange(false)}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="mobile-sheet-title"
        className={cn(
          "relative z-10 w-full overflow-y-auto border-2 border-border",
          "bg-background shadow-lg",
          "max-h-[90dvh] max-w-lg",
          "rounded-t-lg border-b-0",
          "md:max-w-md md:rounded-lg md:border-b-2",
        )}
      >
        <header
          className={cn(
            "flex min-h-12 items-center justify-between",
            "border-b-2 border-border bg-primary px-4 text-primary-foreground",
          )}
        >
          <h2 id="mobile-sheet-title" className="font-head text-base">
            {title}
          </h2>
          <button
            type="button"
            aria-label="Close sheet"
            className="flex h-11 w-11 items-center justify-center"
            onClick={() => onOpenChange(false)}
          >
            <X size={20} />
          </button>
        </header>
        <div className="p-4 md:p-5">{children}</div>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { X } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

interface MobileSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: ReactNode;
}

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

export function MobileSheet({
  open,
  onOpenChange,
  title,
  children,
}: MobileSheetProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    const previouslyFocused = document.activeElement as HTMLElement | null;
    const dialog = dialogRef.current;

    // Move focus into the sheet.
    const firstFocusable =
      dialog?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
    firstFocusable?.focus();

    // Lock body scroll while open.
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.stopPropagation();
        onOpenChange(false);
        return;
      }

      if (event.key !== "Tab" || !dialog) {
        return;
      }

      const focusables = Array.from(
        dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
      ).filter((el) => el.offsetParent !== null);

      if (focusables.length === 0) {
        return;
      }

      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;

      if (event.shiftKey && (active === first || !dialog.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus();
    };
  }, [open, onOpenChange]);

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
        tabIndex={-1}
        className="absolute inset-0 bg-black/85"
        onClick={() => onOpenChange(false)}
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="mobile-sheet-title"
        className={cn(
          "relative z-10 w-full overflow-y-auto border border-border",
          "bg-background",
          "max-h-[90dvh] max-w-lg",
          "rounded-t-lg border-b-0",
          "md:max-w-md md:rounded-lg md:border-b",
        )}
      >
        <header
          className={cn(
            "flex min-h-12 items-center justify-between",
            "border-b border-border bg-card px-4 text-foreground",
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

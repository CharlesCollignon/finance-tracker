"use client";

import { useEffect } from "react";
import { CloudArrowUp } from "@phosphor-icons/react";
import { drainOutbox, useOutbox, watchConnection } from "@/lib/offline-outbox";
import { cn } from "@/lib/utils";

/**
 * Says what is still only on this device.
 *
 * An entry saved offline looks identical to one that reached the server, and
 * that is exactly the ambiguity that makes people re-enter things or lose
 * them. The banner exists so "saved" never quietly means "saved nowhere yet".
 *
 * It shows only when something is waiting, so in normal use it is invisible.
 */
export function OutboxBanner() {
  const { entries, label, retry } = useOutbox();

  // Draining is driven by the browser's own online event rather than polling.
  useEffect(() => watchConnection(), []);

  // A tab regaining focus is a good moment to try again — coming back from a
  // dead zone does not always fire an online event.
  useEffect(() => {
    function onVisible() {
      if (document.visibilityState === "visible") {
        void drainOutbox();
      }
    }
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, []);

  if (!label) {
    return null;
  }

  const failing = entries.some((entry) => entry.attempts > 0);

  return (
    <div
      role="status"
      className={cn(
        "fixed inset-x-0 top-2 z-50 mx-auto w-fit max-w-[calc(100%-2rem)]",
        "flex items-center gap-3 rounded-full border px-4 py-2 shadow-lg",
        "bg-background/95 backdrop-blur-xl",
        failing ? "border-destructive/50" : "border-border",
      )}
    >
      <CloudArrowUp size={16} className="shrink-0 text-muted-foreground" />
      <span className="truncate text-sm">{label}</span>
      <button
        type="button"
        onClick={retry}
        className="shrink-0 text-sm font-medium text-primary-ink underline underline-offset-4"
      >
        Retry
      </button>
    </div>
  );
}

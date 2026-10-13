"use client";

import { useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { FileArrowUp, X } from "@phosphor-icons/react";
import { Button } from "@/components/ui/Button";
import { ICON } from "@/lib/icon-scale";
import { useT } from "@/lib/locale-context";
import { cn } from "@/lib/utils";

/** Where a dismissal is remembered: on this browser, as a convenience. */
const DISMISSED_KEY = "pluclair.importInvite.dismissed";

/** Nothing to subscribe to: the answer only differs between server and browser. */
function subscribeToNothing() {
  return () => {};
}

function dismissedHere(): boolean {
  try {
    return window.localStorage.getItem(DISMISSED_KEY) === "1";
  } catch {
    return false;
  }
}

/**
 * The Journal's invitation to bring the bank's statement, for a ledger no
 * line has come into yet — the place the bank's invitation held while the
 * bank was open to all. Gone once a statement is imported, or once waved
 * away here.
 */
export function ImportInvite({ className }: { className?: string }) {
  const t = useT();
  // Read after hydration, so the server's page and the browser's agree.
  const dismissed = useSyncExternalStore(
    subscribeToNothing,
    dismissedHere,
    () => false,
  );
  const [gone, setGone] = useState(false);

  if (gone || dismissed) {
    return null;
  }

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-3 rounded-control border border-primary/30 bg-accent px-3 py-2.5",
        className,
      )}
    >
      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
        <FileArrowUp size={ICON.md} weight="bold" aria-hidden />
      </span>
      <div className="min-w-0 flex-1 basis-48">
        <p className="text-sm font-medium">{t("statements.inviteTitle")}</p>
        <p className="text-xs text-muted-foreground">
          {t("statements.inviteBody")}
        </p>
      </div>
      <Button
        size="sm"
        className="shrink-0"
        render={<Link href="/import">{t("statements.heading")}</Link>}
      />
      <button
        type="button"
        onClick={() => {
          setGone(true);
          try {
            window.localStorage.setItem(DISMISSED_KEY, "1");
          } catch {
            // Not remembered: it shows again on the next visit.
          }
        }}
        aria-label={t("statements.inviteDismiss")}
        className="flex size-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors duration-hover hover:bg-muted hover:text-foreground"
      >
        <X size={ICON.sm} />
      </button>
    </div>
  );
}

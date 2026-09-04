"use client";

import { ArrowsClockwise } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { useRefresh } from "@/components/layout/RefreshProvider";

/**
 * The refresh, in the band every surface already has.
 *
 * Two shapes of the same control. In the header it is an icon the size of the
 * privacy toggle beside it, because the header is the one piece of furniture
 * on every screen and it is already full. In the sidebar, where there is
 * room, it says how old the figures are — which is the half of the answer a
 * button alone cannot give: a refresh that reports nothing new is only
 * reassuring if you know when it last managed to ask.
 */
export function RefreshButton({
  variant = "icon",
  className,
}: {
  variant?: "icon" | "wide";
  className?: string;
}) {
  const refresh = useRefresh();

  if (!refresh) {
    return null;
  }

  const { running, age, stale, connected, known } = refresh;
  const label = !connected
    ? "Reload everything"
    : running
      ? "Asking your bank…"
      : known
        ? `Refresh — last checked ${age}`
        : "Ask your bank for anything new";

  if (variant === "icon") {
    return (
      <button
        type="button"
        onClick={refresh.refresh}
        disabled={running}
        aria-label={label}
        title={label}
        className={cn(
          "relative inline-flex h-9 w-9 shrink-0 items-center justify-center",
          "rounded-md border border-border bg-card text-muted-foreground",
          "transition-colors hover:bg-muted hover:text-foreground",
          "disabled:cursor-wait disabled:opacity-70",
          className,
        )}
      >
        <ArrowsClockwise
          size={18}
          weight="regular"
          className={cn(running && "animate-spin")}
        />
        {/* A dot rather than a colour on the icon itself: the icon is
            already carrying the spin, and something that is merely a few
            hours old is not a warning. */}
        {stale && connected && !running ? (
          <span
            aria-hidden
            className="absolute right-1.5 top-1.5 size-1.5 rounded-full bg-primary-rim"
          />
        ) : null}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={refresh.refresh}
      disabled={running}
      className={cn(
        "flex min-h-10 w-full items-center gap-3 rounded-md px-3 py-2",
        "text-sm font-medium text-muted-foreground",
        "transition-colors hover:bg-muted hover:text-foreground",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        "disabled:cursor-wait",
        className,
      )}
    >
      <ArrowsClockwise
        size={18}
        weight="light"
        className={cn("shrink-0", running && "animate-spin")}
      />
      {running ? "Refreshing…" : "Refresh"}
      {connected && known && !running ? (
        <span
          className={cn(
            "ml-auto truncate text-xs",
            stale ? "text-primary-ink" : "text-muted-foreground/70",
          )}
        >
          {age}
        </span>
      ) : null}
    </button>
  );
}

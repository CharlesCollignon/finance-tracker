"use client";

import { ArrowsClockwise } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { useRefresh } from "@/components/layout/RefreshProvider";
import { ICON } from "@/lib/icon-scale";
import { useT } from "@/lib/locale-context";

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
  const t = useT();
  const refresh = useRefresh();

  if (!refresh) {
    return null;
  }

  const { running, age, stale, connected, known } = refresh;
  const label = !connected
    ? t("refresh.reloadEverything")
    : running
      ? t("refresh.askingBank")
      : known
        ? t("refresh.lastChecked", { age })
        : t("refresh.askBank");

  if (variant === "icon") {
    return (
      <button
        type="button"
        onClick={refresh.refresh}
        disabled={running}
        aria-label={label}
        title={label}
        className={cn(
          // 44px square, which is the documented touch floor, while the icon
          // inside stays the size it was. The header is `3.25rem` (52px) tall
          // and the control sits inside that with 4px to spare, so raising it
          // from `h-9 w-9` costs the band no height.
          "relative inline-flex size-11 shrink-0 items-center justify-center",
          "rounded-control border border-border bg-card text-muted-foreground",
          "transition-colors hover:bg-muted hover:text-foreground",
          "disabled:cursor-wait disabled:opacity-70",
          className,
        )}
      >
        <ArrowsClockwise
          size={ICON.lg}
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
        "flex min-h-10 w-full items-center gap-3 rounded-control px-3 py-2",
        "text-sm font-medium text-muted-foreground",
        "transition-colors hover:bg-muted hover:text-foreground",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        "disabled:cursor-wait",
        className,
      )}
    >
      <ArrowsClockwise
        size={ICON.lg}
        weight="light"
        className={cn("shrink-0", running && "animate-spin")}
      />
      {running ? t("refresh.refreshing") : t("refresh.refresh")}
      {connected && known && !running ? (
        // The age was set in `text-muted-foreground/70`, which is about 3.9:1
        // at 11px — under the 4.5:1 floor, and on the one string here that
        // says how much to trust the figures. Full-strength muted foreground
        // is the token that already means "secondary text"; the size is what
        // keeps it secondary.
        <span
          className={cn(
            "ml-auto truncate text-xs",
            stale ? "text-primary-ink" : "text-muted-foreground",
          )}
        >
          {age}
        </span>
      ) : null}
    </button>
  );
}

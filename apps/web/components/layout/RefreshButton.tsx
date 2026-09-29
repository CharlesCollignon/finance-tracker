"use client";

import { ArrowsClockwise } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { useRefresh } from "@/components/layout/RefreshProvider";
import { ICON } from "@/lib/icon-scale";
import { useT } from "@/lib/locale-context";

/**
 * The refresh: in the phone's header band, and in the desktop's top bar.
 *
 * An icon the size of the privacy toggle, because both bars are furniture on
 * every screen and both are already full. How old the figures are — the half
 * of the answer a button alone cannot give, since a refresh that reports
 * nothing new is only reassuring if you know when it last managed to ask —
 * is in its name and its tooltip. There was a wide shape that printed the
 * age beside the icon, for the side rail; the rail went, and the shape with
 * it.
 *
 * `tone` is the company it keeps. In the phone's glass header it is a
 * bordered square on a card fill, like the privacy toggle beside it; in the
 * desktop's top bar it is a bare circle, like the privacy toggle and the
 * avatar beside it there, so the three read as one group.
 */
export function RefreshButton({
  tone = "band",
  className,
}: {
  tone?: "band" | "bar";
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
        "relative inline-flex size-11 shrink-0 cursor-pointer items-center justify-center",
        "text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
        tone === "band"
          ? "rounded-control border border-border bg-card"
          : "rounded-full",
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
          className="absolute right-1.5 top-1.5 size-1.5 rounded-full bg-muted-foreground"
        />
      ) : null}
    </button>
  );
}

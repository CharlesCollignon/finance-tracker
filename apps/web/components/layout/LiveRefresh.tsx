"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

/** The channel tabs of this app tell each other about writes on. */
const CHANNEL = "pluclair:writes";

/**
 * Coming back to a tab that has been away longer than this redraws it. Long
 * enough that flicking between two tabs does not re-render on every flick,
 * short enough that the phone's write a minute ago is on screen when the
 * laptop is picked up again.
 */
const AWAY_MS = 60_000;

/** Never two redraws closer together than this, whatever asked for them. */
const MIN_GAP_MS = 3_000;

/**
 * Keeps an open tab in step with writes it did not make.
 *
 * A write made in this tab already redraws it: every action ends in
 * `revalidateApp`. What nothing covered was everything else that writes the
 * same ledger — another tab, the phone, the bank sync four times a day — so a
 * Journal left open on the laptop went on showing the inbox rows the phone
 * had just filed, until someone thought to reload.
 *
 * Two signals, no polling and no socket:
 * - **Another tab wrote.** The layout renders again after every write, so a
 *   new `renderedAt` that this component did not ask for means this tab's
 *   action changed something, and it says so on a BroadcastChannel. A tab in
 *   view redraws on hearing it; one out of view marks itself and redraws
 *   when it comes back.
 * - **This tab comes back** — into view, or into focus beside another window
 *   — after more than a minute away, which is when the phone or the cron is
 *   likely to have written. Cheaper than a live subscription and right at the
 *   moment it matters: nobody reads a tab they are not looking at.
 */
export function LiveRefresh({ renderedAt }: { renderedAt: number }) {
  const router = useRouter();
  const seen = useRef(renderedAt);
  const lastRedraw = useRef(renderedAt);
  const askedForRedraw = useRef(false);
  const behind = useRef(false);
  const hiddenSince = useRef<number | null>(null);
  const channel = useRef<BroadcastChannel | null>(null);

  // A render this tab did not ask for is a write this tab made.
  useEffect(() => {
    if (renderedAt === seen.current) {
      return;
    }
    seen.current = renderedAt;
    lastRedraw.current = Date.now();
    if (askedForRedraw.current) {
      askedForRedraw.current = false;
      return;
    }
    channel.current?.postMessage("written");
  }, [renderedAt]);

  useEffect(() => {
    function redraw() {
      if (Date.now() - lastRedraw.current < MIN_GAP_MS) {
        return;
      }
      behind.current = false;
      askedForRedraw.current = true;
      lastRedraw.current = Date.now();
      router.refresh();
    }

    function comeBack() {
      const away =
        hiddenSince.current === null ? 0 : Date.now() - hiddenSince.current;
      hiddenSince.current = null;
      if (
        behind.current ||
        away > AWAY_MS ||
        Date.now() - lastRedraw.current > AWAY_MS
      ) {
        redraw();
      }
    }

    function onVisibility() {
      if (document.visibilityState === "hidden") {
        hiddenSince.current = Date.now();
      } else {
        comeBack();
      }
    }

    function onMessage() {
      if (document.visibilityState === "visible") {
        redraw();
      } else {
        behind.current = true;
      }
    }

    // Absent in a few embedded browsers; the visibility signal still works.
    if (typeof BroadcastChannel !== "undefined") {
      channel.current = new BroadcastChannel(CHANNEL);
      channel.current.addEventListener("message", onMessage);
    }
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", comeBack);
    return () => {
      channel.current?.close();
      channel.current = null;
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", comeBack);
    };
  }, [router]);

  return null;
}

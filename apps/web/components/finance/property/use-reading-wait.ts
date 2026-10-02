"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

/** How often the page asks again, and for how long. */
const ASK_EVERY_MS = 3_000;
const GIVE_UP_AFTER_MS = 60_000;

/**
 * Waiting on a market reading the server is finishing after its response
 * (`readPropertyMarketSoon`): the page asks again every few seconds until
 * what it shows of the market changes, or a minute has passed — then the
 * weekly cron has it.
 *
 * `shown` is what the page draws of the reading and the asking rents; any
 * change in it means the reading landed. Starting from a link that says a
 * reading is on its way (`?lecture=1`, after adding a property), or from
 * `start()`, after an edit.
 */
export function useReadingWait(
  shown: string,
  startWaiting: boolean,
): { waiting: boolean; start: () => void } {
  const router = useRouter();
  const [since, setSince] = useState<string | null>(
    startWaiting ? shown : null,
  );
  // Over as soon as what is shown moves on from where the wait began.
  const waiting = since !== null && since === shown;

  useEffect(() => {
    if (startWaiting) {
      // The link said so once; a reload should not wait again.
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, [startWaiting]);

  useEffect(() => {
    if (!waiting) {
      return;
    }
    const ask = window.setInterval(() => router.refresh(), ASK_EVERY_MS);
    const stop = window.setTimeout(() => setSince(null), GIVE_UP_AFTER_MS);
    return () => {
      window.clearInterval(ask);
      window.clearTimeout(stop);
    };
  }, [waiting, router]);

  const start = useCallback(() => setSince(shown), [shown]);
  return { waiting, start };
}

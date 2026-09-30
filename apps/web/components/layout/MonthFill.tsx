"use client";

import { useEffect, useRef, useTransition } from "react";
import { getCurrentMonth } from "@finance/core/constants";
import { resolveMessage } from "@finance/core/i18n/t";
import { useToast } from "@/components/layout/ToastProvider";
import { fillThisMonth } from "@/lib/actions/finance";
import { useT } from "@/lib/locale-context";

/**
 * Fills the month in progress from the user's charges: once when the app
 * opens, and again when a tab left open comes back into view in another
 * month.
 *
 * This is what replaced the Apply button. The daily run on the server does
 * the same at the start of each day, so this is usually a check that finds
 * nothing; it is here for whoever opens the app before that run, on a
 * deployment without one, or in a tab that was open when the month turned.
 *
 * Says so when it wrote something. Rows appearing in the ledger with nobody
 * having typed them are only unsurprising if the app admits to them.
 */
export function MonthFill() {
  const t = useT();
  const { toast } = useToast();
  const [, startTransition] = useTransition();
  // Which month was last asked about, so a re-render, a second focus or
  // Strict Mode's double effect does not ask again.
  const askedFor = useRef<string | null>(null);

  useEffect(() => {
    function fill() {
      const { year, month } = getCurrentMonth();
      const key = `${year}-${month}`;
      if (askedFor.current === key) {
        return;
      }
      askedFor.current = key;

      startTransition(async () => {
        try {
          const result = await fillThisMonth();
          if (result.error) {
            toast(resolveMessage(t, result.error), "error");
          } else if (result.created > 0) {
            toast(t("monthFill.added", { count: result.created }), "success");
          }
        } catch {
          // Offline, most likely. The next visit asks again.
          askedFor.current = null;
        }
      });
    }

    fill();

    function handleVisibility() {
      if (document.visibilityState === "visible") {
        fill();
      }
    }

    document.addEventListener("visibilitychange", handleVisibility);
    return () =>
      document.removeEventListener("visibilitychange", handleVisibility);
  }, [t, toast]);

  return null;
}

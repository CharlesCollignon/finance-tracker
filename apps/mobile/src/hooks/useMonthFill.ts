import { useEffect, useRef } from "react";
import { AppState } from "react-native";

import { getCurrentMonth } from "@finance/core/constants";
import { resolveMessage } from "@finance/core/i18n/t";

import { fillThisMonth } from "@/lib/mutations";
import { useAuth } from "@/providers/AuthProvider";
import { useT } from "@/providers/LocaleProvider";
import { useToast } from "@/providers/ToastProvider";

/**
 * Fills the month in progress from the user's charges: once when the tabs
 * mount, and again when the app comes back to the foreground in another
 * month.
 *
 * This is what replaced the Apply button, and the web twin
 * (`components/layout/MonthFill.tsx`) does the same in a browser. The
 * server's daily run fills the month too, so this is usually a check that
 * finds nothing; it is here for whoever opens the app before that run, or
 * after the month turned over while it sat in the background.
 *
 * Says so when it wrote something. Rows appearing in the ledger with nobody
 * having typed them are only unsurprising if the app admits to them.
 */
export function useMonthFill(): void {
  const { user } = useAuth();
  const t = useT();
  const { toast } = useToast();
  // Which user and month were last asked about, so a re-render, a second
  // foregrounding or a remount does not ask again.
  const askedFor = useRef<string | null>(null);
  // Kept in refs so the AppState listener is registered once per user and
  // still speaks the current language.
  const translate = useRef(t);
  const notify = useRef(toast);

  useEffect(() => {
    translate.current = t;
    notify.current = toast;
  });

  const userId = user?.id ?? null;

  useEffect(() => {
    if (!userId) {
      return;
    }

    async function fill() {
      const { year, month } = getCurrentMonth();
      const key = `${userId}:${year}-${month}`;
      if (askedFor.current === key) {
        return;
      }
      askedFor.current = key;

      try {
        const result = await fillThisMonth();
        if (result.error) {
          notify.current(
            resolveMessage(translate.current, result.error),
            "error",
          );
        } else if (result.created > 0) {
          // The rows announced themselves on the way in, so every screen —
          // the Bearing, the Ledger, the Calendar — has them already.
          notify.current(
            translate.current("monthFill.added", { count: result.created }),
            "success",
          );
        }
      } catch {
        // Offline, most likely. The next foregrounding asks again.
        askedFor.current = null;
      }
    }

    void fill();

    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        void fill();
      }
    });
    return () => subscription.remove();
  }, [userId]);
}

import { useEffect, useRef } from "react";
import { AppState } from "react-native";

import { useDataVersion, type DataArea } from "@/lib/data-version";

import { updateWidget } from "./update";

/** What the figure is read from: rows, charges, closes and balances, the bank. */
const FIGURE_AREAS: readonly DataArea[] = [
  "transactions",
  "templates",
  "closes",
  "bank",
  "accounts",
];

/**
 * Keeps the home-screen widget in step with the app (Android; a no-op
 * elsewhere).
 *
 * The widget cannot be seen while the app is in front, so it is drawn on the
 * way to the background: read anew when something under the figure changed
 * since the last time — a spend added, a close, a bank sync — and only drawn
 * again otherwise, which picks up the privacy blur, the language and the
 * currency. Signing out forgets the figure at once.
 */
export function useWidgetSync(userId: string | null, ready: boolean): void {
  const version = useDataVersion(FIGURE_AREAS);
  const stale = useRef(true);

  useEffect(() => {
    stale.current = true;
  }, [version, userId]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state !== "background") {
        return;
      }
      const reread = stale.current;
      stale.current = false;
      updateWidget({ reread }).catch(() => {
        stale.current = true;
      });
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (ready && userId === null) {
      void updateWidget({ reread: true }).catch(() => undefined);
    }
  }, [ready, userId]);
}

import { useEffect, useEffectEvent } from "react";
import { AppState } from "react-native";

/**
 * Runs `onReturn` each time the app comes back from the background.
 *
 * From the background only, not from "inactive": iOS passes through inactive
 * for a Face ID prompt, a pulled-down control centre or a permission dialog,
 * and none of those is the reader having been away. Coming back from
 * elsewhere is — the bank synced overnight, a row was filed on the web, the
 * date moved on — which is what the callers here want to know.
 *
 * The latest callback is read at call time — an effect event, so the
 * listener is registered once for the life of the component and never
 * calls a callback from an earlier render.
 */
export function useAppForeground(onReturn: () => void): void {
  const returned = useEffectEvent(onReturn);

  useEffect(() => {
    let previous = AppState.currentState;
    const subscription = AppState.addEventListener("change", (next) => {
      if (previous === "background" && next === "active") {
        returned();
      }
      previous = next;
    });
    return () => subscription.remove();
  }, []);
}

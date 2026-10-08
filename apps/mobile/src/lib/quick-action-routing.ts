import { useEffect } from "react";
import { useRouter, type Href } from "expo-router";

import {
  addQuickActionListener,
  takePendingQuickAction,
} from "../../modules/quick-actions";

/** The screen a quick action's `pluclair://` address names. */
function routeFor(href: string): Href {
  return href === "pluclair://add" ? "/add" : "/";
}

/**
 * Follows a home-screen quick action on iOS (`plugins/with-quick-actions.js`):
 * the one that opened the app, once there is a session to land in, and any
 * pressed while it runs. Android's open their address directly.
 */
export function useQuickActionRouting(ready: boolean): void {
  const router = useRouter();

  useEffect(() => {
    if (!ready) {
      return;
    }
    const pending = takePendingQuickAction();
    if (pending) {
      router.push(routeFor(pending));
    }
    const subscription = addQuickActionListener((href) =>
      router.push(routeFor(href)),
    );
    return () => subscription?.remove();
  }, [ready, router]);
}

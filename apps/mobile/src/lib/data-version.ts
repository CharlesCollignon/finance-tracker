import { useSyncExternalStore } from "react";

/**
 * A counter that changes whenever ledger data is written from outside the
 * screen showing it.
 *
 * Screens load their own data with `useRefreshable`, which re-runs when its
 * deps change. That works while every write happens on the screen that owns
 * the data — but the quick-add sheet writes transactions from anywhere, so
 * Home and Calendar would keep showing stale figures until pulled to refresh.
 * Including `useDataVersion()` in a screen's deps closes that gap without
 * introducing a client cache.
 */

let version = 0;
const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): number {
  return version;
}

/** Call after any write that screens elsewhere in the app should pick up. */
export function notifyDataChanged(): void {
  version += 1;
  for (const listener of listeners) {
    listener();
  }
}

/** Include in a `useRefreshable` dependency list to reload after such a write. */
export function useDataVersion(): number {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

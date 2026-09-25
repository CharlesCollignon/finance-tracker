import { useCallback, useEffect, useRef, useState } from "react";

import { useRefreshAll } from "@/providers/RefreshProvider";

/**
 * Load async data, with the two kinds of reload a screen actually needs.
 * `deps` re-trigger a load when they change (e.g. month).
 *
 * The distinction between them is the whole reason there are two. Dragging a
 * list down is a request for everything to be as current as it can be, and it
 * is worth a bank round trip. Coming back from having saved a category is
 * not: the screen already knows what changed, and asking a bank about it
 * would be a slow answer to a question nobody asked.
 */
export function useRefreshable<T>(
  loader: () => Promise<T>,
  deps: unknown[] = [],
): {
  data: T | null;
  error: string | null;
  loading: boolean;
  refreshing: boolean;
  reload: () => Promise<void>;
  /** Re-read this screen's own data. For after a write. */
  onRefresh: () => void;
  /** Re-read, and ask the bank too. For the drag-down gesture. */
  onRefreshAll: () => void;
} {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  // Every call site passes primitives (ids, a year, a month, a data version),
  // so their JSON is a faithful key for "the inputs changed".
  const depsKey = JSON.stringify(deps);
  // The key of the last load that finished. Loading is simply "the current
  // inputs have not finished loading yet", derived rather than flipped in an
  // effect.
  const [settledKey, setSettledKey] = useState<string | null>(null);
  const loading = settledKey !== depsKey;
  // Null on the auth and onboarding screens, which render outside the
  // provider. There the gesture is a re-read and nothing more, which is all
  // it can be before anyone is signed in.
  const refreshAll = useRefreshAll();

  // The latest loader, read at call time. Declared before the load effect so
  // it has already been updated when that effect runs.
  const loaderRef = useRef(loader);
  useEffect(() => {
    loaderRef.current = loader;
  });

  const reload = useCallback(async () => {
    try {
      const next = await loaderRef.current();
      setError(null);
      setData(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    loaderRef
      .current()
      .then(
        (next) => {
          if (!cancelled) {
            setError(null);
            setData(next);
          }
        },
        (err: unknown) => {
          if (!cancelled) {
            setError(
              err instanceof Error ? err.message : "Something went wrong",
            );
          }
        },
      )
      .finally(() => {
        if (!cancelled) {
          setSettledKey(depsKey);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [depsKey]);

  function onRefresh() {
    setRefreshing(true);
    reload().finally(() => setRefreshing(false));
  }

  /**
   * The drag-down gesture, which asks the bank as well as re-reading.
   *
   * Deliberately not awaited into the spinner. The local re-read takes a
   * couple of hundred milliseconds; the bank ask is allowed a full minute
   * — `/api/bank/refresh` declares `maxDuration = 60` and the phone waits it
   * out — and a drag-down spinner held that long stops reading as "working"
   * and starts reading as "stuck", on the one gesture people use most.
   *
   * So the gesture settles at its own pace and the bank ask carries on
   * behind it, where it already has somewhere to show: the header icon spins
   * for as long as it runs, the toast says what it came to, and anything it
   * added reaches this screen through `notifyDataChanged`. Pulling again
   * while one is in flight re-reads and does not start a second.
   */
  function onRefreshAll() {
    refreshAll?.refresh();
    onRefresh();
  }

  return {
    data,
    error,
    loading,
    refreshing,
    reload,
    onRefresh,
    onRefreshAll,
  };
}

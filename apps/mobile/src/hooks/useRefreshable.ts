import { useIsFocused } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";

import { ALL_AREAS, useDataVersion, type DataArea } from "@/lib/data-version";
import { useRefreshAction } from "@/providers/RefreshProvider";

/**
 * Load async data, with the two kinds of reload a screen actually needs.
 * `deps` name what the screen shows (a user, a month, a language): a change
 * there is a different picture, and the screen loads it from scratch.
 * `reads` names the data areas it is drawn from: a write to one of them is
 * the same picture made current, and the screen reloads it in place.
 *
 * Two things follow from keeping those apart. A reload after a write keeps
 * the figures on screen until the new ones arrive, rather than dropping to a
 * skeleton for every coffee logged. And a screen nobody is looking at does
 * not reload at all — the tabs stay mounted once visited, so one write used
 * to set about fifteen loaders going behind the one in view. It remembers it
 * is behind instead, and catches up the moment it is shown again.
 *
 * The distinction between the two manual reloads is the other reason this
 * exists. Dragging a list down is a request for everything to be as current
 * as it can be, and it is worth a bank round trip. Coming back from having
 * saved a category is not: the screen already knows what changed, and asking
 * a bank about it would be a slow answer to a question nobody asked.
 */
export function useRefreshable<T>(
  loader: () => Promise<T>,
  deps: unknown[] = [],
  { reads = ALL_AREAS }: { reads?: readonly DataArea[] } = {},
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
  // Every call site passes primitives (ids, a year, a month, a language), so
  // their JSON is a faithful key for "the inputs changed".
  const depsKey = JSON.stringify(deps);
  // The key of the last load that finished. Loading is simply "the current
  // inputs have not finished loading yet", derived rather than flipped in an
  // effect — and only the inputs count, so a reload for fresher data never
  // turns it on.
  const [settledKey, setSettledKey] = useState<string | null>(null);
  const loading = settledKey !== depsKey;
  const version = useDataVersion(reads);
  const focused = useIsFocused();
  // Null on the auth and onboarding screens, which render outside the
  // provider. There the gesture is a re-read and nothing more, which is all
  // it can be before anyone is signed in.
  const refreshAll = useRefreshAction();

  // The latest loader and inputs, read at call time. Declared before the
  // load effects so they have already been updated when those run.
  const latest = useRef({ loader, depsKey, version });
  useEffect(() => {
    latest.current = { loader, depsKey, version };
  });
  // Which load is the newest. Loads overlap — a write lands while the month
  // is still loading — and only the last one asked for may reach the screen,
  // or a slow early answer would overwrite a quick later one.
  const sequence = useRef(0);
  // The data version the screen's data was last asked for at.
  const loadedVersion = useRef(version);
  const hasData = useRef(false);

  // Settled in callbacks rather than awaited, so nothing is set while the
  // effects that start a load are still running.
  const load = useCallback((): Promise<void> => {
    const id = ++sequence.current;
    const { loader: current, depsKey: key, version: at } = latest.current;
    loadedVersion.current = at;
    return current()
      .then(
        (next) => {
          if (id === sequence.current) {
            hasData.current = true;
            setError(null);
            setData(next);
          }
        },
        (err: unknown) => {
          // A failed reload behind figures already on screen keeps them:
          // the phone coming back online will ask again, and replacing a
          // good screen with an error because one background read missed is
          // worse than showing the last answer for a little longer.
          if (id === sequence.current && !hasData.current) {
            // A message key when there is no error text; screens resolve it.
            setError(err instanceof Error ? err.message : "errorPage.title");
          }
        },
      )
      .finally(() => {
        if (id === sequence.current) {
          setSettledKey(key);
        }
      });
  }, []);

  // A different picture: load it whether or not the screen is in view, so a
  // month picked on the Journal is ready on Le point by the time it is shown.
  useEffect(() => {
    hasData.current = false;
    void load();
  }, [depsKey, load]);

  // The same picture, made current — now if it is in view, or as soon as it
  // is shown again.
  useEffect(() => {
    if (focused && version !== loadedVersion.current) {
      void load();
    }
  }, [focused, version, load]);

  const reload = useCallback(() => load(), [load]);

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
   * added reaches this screen as a data change. Pulling again while one is
   * in flight re-reads and does not start a second.
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

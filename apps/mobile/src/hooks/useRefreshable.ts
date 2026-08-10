import { useCallback, useEffect, useState } from "react";

/**
 * Load async data with pull-to-refresh support.
 * `deps` re-trigger a load when they change (e.g. month).
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
  onRefresh: () => void;
} {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const reload = useCallback(async () => {
    try {
      setError(null);
      const next = await loader();
      setData(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    }
  }, deps);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    reload().finally(() => {
      if (!cancelled) {
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [reload]);

  function onRefresh() {
    setRefreshing(true);
    reload().finally(() => setRefreshing(false));
  }

  return { data, error, loading, refreshing, reload, onRefresh };
}

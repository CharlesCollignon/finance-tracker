/**
 * Every row of a query the server caps.
 *
 * PostgREST answers at most `max_rows` rows (1,000 in `supabase/config.toml`)
 * and says nothing when it stops short, so a total over a long history is
 * silently wrong past that point. This reads page after page until one comes
 * back short. The caller orders the query by a unique column, or rows could
 * repeat or vanish between pages.
 */
export const PAGE_SIZE = 1000;

export async function allRows<T>(
  page: (
    from: number,
    to: number,
  ) => PromiseLike<{ data: T[] | null; error: unknown }>,
  options: {
    /**
     * Stop after this many rows. For a read that wants the most recent few
     * thousand on purpose — a `.limit(2000)` is silently 1,000 under the
     * cap, which is how such a read used to lose half of what it asked for.
     */
    max?: number;
  } = {},
): Promise<T[]> {
  const max = options.max ?? Infinity;
  const rows: T[] = [];
  for (let from = 0; from < max; from += PAGE_SIZE) {
    const to = Math.min(from + PAGE_SIZE, max) - 1;
    const { data, error } = await page(from, to);
    if (error) {
      throw error;
    }
    const batch = data ?? [];
    rows.push(...batch);
    if (batch.length < to - from + 1) {
      return rows;
    }
  }
  return rows;
}

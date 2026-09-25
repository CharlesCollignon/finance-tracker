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
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await page(from, from + PAGE_SIZE - 1);
    if (error) {
      throw error;
    }
    const batch = data ?? [];
    rows.push(...batch);
    if (batch.length < PAGE_SIZE) {
      return rows;
    }
  }
}

import type { SupabaseClient } from "@supabase/supabase-js";
import { describeReadFreshness } from "@finance/core/month-read-budget";
import { readFooting, renderMonthRead } from "@finance/core/month-read";
import type { MonthFacts } from "@finance/core/month-facts";
import type { Database } from "@finance/core/types/database";
import { readMonthReadState } from "@/lib/month-read/store";
import type { ReadFreshness } from "@finance/core/month-read-budget";
import type { MonthRead } from "@finance/core/month-read";
import type { Locale } from "@finance/core/i18n/locale";

type Client = SupabaseClient<Database>;

export interface MonthReadView {
  read: MonthRead;
  /** The pack the read was written from, for detecting movement. */
  storedFacts: MonthFacts;
  writtenAt: string;
  /**
   * The language the prose is in, which may not be the reader's.
   *
   * A read is not rewritten when somebody switches language — that would
   * spend an allowance they did not ask to spend — so it stays in the
   * language it was written in, and the card says so.
   */
  locale: Locale;
  freshness: ReadFreshness;
}

/**
 * The stored read for a month, with how well it still stands.
 *
 * Rendering is left to the caller, which has the reader's currency formatter;
 * this returns the read and the verdict on its footing. Null when nothing has
 * been written, when the schema is absent, or when the stored row has no
 * usable read on it — all of which the card treats the same way.
 */
export async function getMonthRead(
  userId: string,
  year: number,
  month: number,
  currentFacts: MonthFacts,
  client?: Client,
): Promise<MonthReadView | null> {
  const { stored } = await readMonthReadState(userId, year, month, client);

  if (!stored?.read || !stored.facts || !stored.writtenAt) {
    return null;
  }

  return {
    read: stored.read,
    storedFacts: stored.facts,
    writtenAt: stored.writtenAt,
    locale: stored.locale,
    freshness: describeReadFreshness({
      storedFacts: stored.facts,
      currentFacts,
      footing: readFooting(stored.read),
      writtenAt: stored.writtenAt,
      now: new Date().toISOString(),
    }),
  };
}

export { renderMonthRead };

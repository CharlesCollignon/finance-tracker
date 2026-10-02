import { todayIsoLocal } from "@finance/core/constants";
import { getWeeklyRecapCard } from "@finance/data/weekly-recap";
import { WeeklyRecapCard } from "@/components/finance/bearing/WeeklyRecapCard";
import { getLocale } from "@/lib/locale";
import { createClient } from "@/lib/supabase/server";

/**
 * The week's recap on the Bearing, early in the week.
 *
 * Streamed in behind its own boundary, as the month read is: it reads a year
 * of rows for each category's normal month, and the balance should not wait
 * on that. A failure leaves the card out rather than the page.
 */
export async function RecapSlot({ userId }: { userId: string }) {
  const recap = await getWeeklyRecapCard(
    await createClient(),
    userId,
    todayIsoLocal(),
    await getLocale(),
  ).catch(() => null);
  return recap ? <WeeklyRecapCard recap={recap} /> : null;
}

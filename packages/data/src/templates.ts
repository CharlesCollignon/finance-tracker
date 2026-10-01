import { recurringOccurrenceKey } from "@finance/core/apply-recurring";
import { getMonthBounds } from "@finance/core/constants";
import type { RecurringTemplateWithCategory } from "@finance/core/types/database";

import type { Db } from "./client";

/** Every recurring template the user has, with its category, oldest first. */
export async function getRecurringTemplates(
  db: Db,
  userId: string,
): Promise<RecurringTemplateWithCategory[]> {
  const { data, error } = await db
    .from("recurring_templates")
    .select("*, categories(name, type, icon, counts_toward_summary)")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

  if (error) {
    throw error;
  }
  return (data ?? []) as RecurringTemplateWithCategory[];
}

/** The occurrences skipped in one month, as occurrence keys. */
export async function getRecurringSkipKeys(
  db: Db,
  userId: string,
  year: number,
  month: number,
): Promise<Set<string>> {
  const { start, end } = getMonthBounds(year, month);
  const { data, error } = await db
    .from("recurring_skips")
    .select("template_id, occurred_on")
    .eq("user_id", userId)
    .gte("occurred_on", start)
    .lte("occurred_on", end);

  if (error) {
    throw error;
  }
  return new Set(
    (data ?? []).map((row) =>
      recurringOccurrenceKey(row.template_id, row.occurred_on),
    ),
  );
}

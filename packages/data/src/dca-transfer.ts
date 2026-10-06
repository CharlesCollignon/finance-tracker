import { recurringOccurrenceKey } from "@finance/core/apply-recurring";
import { shiftIsoDate } from "@finance/core/constants";
import {
  dcaNeedForMonth,
  transferCoversMonth,
  transferReminder,
  type TransferReminder,
} from "@finance/core/dca-need";
import type { RecurringTemplateWithCategory } from "@finance/core/types/database";

import { hasBankFeed, walletCategoriesTheBankDebits } from "./bank-feed";
import type { Db } from "./client";
import { dbError } from "./errors";
import { getBankForecast, getFulfilledKeys } from "./fulfilment";

/** What decides which month a transfer covers. */
type TransferSchedule = Pick<
  RecurringTemplateWithCategory,
  | "id"
  | "created_at"
  | "recurrence"
  | "day_of_month"
  | "day_of_week"
  | "month_of_year"
  | "starts_on"
  | "ends_on"
>;

/** What a transfer's figure is worked out from. */
export interface FollowFacts {
  /** The active charges, the DCAs among them. */
  templates: RecurringTemplateWithCategory[];
  /** Transfer occurrences confirmed, written or skipped. */
  settledKeys: Set<string>;
  /** Every skip from a month back, the DCAs' and the transfers'. */
  skippedKeys: Set<string>;
  /** `walletCategoriesTheBankDebits`. */
  debited: Set<string>;
}

/**
 * Bring each transfer that follows the DCAs (`pricing_type = 'purchases'`)
 * to what the month it covers needs (`dcaNeedForMonth`).
 *
 * Stored in the template's `amount`, the way a share-priced template's last
 * quote is: every reader of a template's amount — the forecast, the
 * projection, the month's fill, « C'est arrivé ? » — then reads the figure
 * without knowing how it was reached. Run where those figures can move: the
 * daily quote refresh, the app opening, and a charge, one of its days or a
 * transfer's confirmation changing. Only what differs is written, and it
 * never throws: a figure a day stale is not worth failing the change that
 * asked for it.
 *
 * A month with no purchase at all leaves the amount as it was: a template
 * cannot be zero, and a month without DCAs is one with nothing to follow.
 *
 * Returns the error, if a read or a write failed.
 */
export async function followPurchases(
  db: Db,
  userId: string,
  today: string,
): Promise<string | null> {
  try {
    const { data: rows, error } = await db
      .from("recurring_templates")
      .select("*, categories(name, type, icon, counts_toward_summary)")
      .eq("user_id", userId)
      .eq("active", true);
    if (error) {
      return dbError(error);
    }

    const templates = (rows ?? []) as RecurringTemplateWithCategory[];
    const transfers = templates.filter(
      (template) => template.pricing_type === "purchases",
    );
    if (transfers.length === 0) {
      return null;
    }

    const facts = await readFollowFacts(db, userId, today, templates);
    if ("error" in facts) {
      return facts.error;
    }

    for (const transfer of transfers) {
      const amount = followedAmount(transfer, facts, today);
      if (amount <= 0 || amount === Number(transfer.amount)) {
        continue;
      }
      const { error: updateError } = await db
        .from("recurring_templates")
        .update({ amount })
        .eq("id", transfer.id)
        .eq("user_id", userId);
      if (updateError) {
        return dbError(updateError);
      }
    }
    return null;
  } catch (error) {
    return error instanceof Error
      ? error.message
      : "actions.couldNotSaveRecurring";
  }
}

/**
 * What a transfer about to be saved as following the DCAs would be: worked
 * out before it is written, since a template's amount cannot be left empty.
 * Zero when the month it would cover holds no DCA.
 */
export async function transferAmountFor(
  db: Db,
  userId: string,
  transfer: TransferSchedule,
  today: string,
): Promise<{ amount: number } | { error: string }> {
  const { data: rows, error } = await db
    .from("recurring_templates")
    .select("*, categories(name, type, icon, counts_toward_summary)")
    .eq("user_id", userId)
    .eq("active", true);
  if (error) {
    return { error: dbError(error) };
  }
  try {
    const facts = await readFollowFacts(
      db,
      userId,
      today,
      (rows ?? []) as RecurringTemplateWithCategory[],
      transfer.id ? [transfer.id] : [],
    );
    return "error" in facts
      ? facts
      : { amount: followedAmount(transfer, facts, today) };
  } catch (cause) {
    return {
      error:
        cause instanceof Error
          ? cause.message
          : "actions.couldNotSaveRecurring",
    };
  }
}

/**
 * The transfer to send now, if one is due (`transferReminder`), for the
 * push before payday and the line on Le point. The salary counts as paid
 * early once the bank has brought a movement that looks like it, or it was
 * confirmed. Null when there is nothing to say, or it could not be read.
 */
export async function getTransferReminder(
  db: Db,
  userId: string,
  today: string,
): Promise<TransferReminder | null> {
  try {
    const { data: rows, error } = await db
      .from("recurring_templates")
      .select("*, categories(name, type, icon, counts_toward_summary)")
      .eq("user_id", userId)
      .eq("active", true);
    if (error) {
      return null;
    }
    const templates = (rows ?? []) as RecurringTemplateWithCategory[];
    if (!templates.some((template) => template.pricing_type === "purchases")) {
      return null;
    }

    const facts = await readFollowFacts(db, userId, today, templates);
    if ("error" in facts) {
      return null;
    }
    const [fulfilled, forecast] = await Promise.all([
      getFulfilledKeys(db, userId),
      (await hasBankFeed(db, userId))
        ? getBankForecast(db, userId, templates, today, facts.debited)
        : null,
    ]);

    return transferReminder({
      templates,
      today,
      settledKeys: facts.settledKeys,
      skippedKeys: facts.skippedKeys,
      debited: facts.debited,
      arrivedKeys: new Set([...fulfilled, ...(forecast?.arrived ?? [])]),
    });
  } catch {
    return null;
  }
}

/** The figure one transfer stands for, or 0 with nothing to follow. */
function followedAmount(
  transfer: TransferSchedule,
  { templates, settledKeys, skippedKeys, debited }: FollowFacts,
  today: string,
): number {
  const covered = transferCoversMonth(
    transfer,
    today,
    new Set([...settledKeys, ...skippedKeys]),
  );
  if (!covered) {
    return 0;
  }
  return dcaNeedForMonth({
    templates,
    debited,
    skippedKeys,
    year: covered.year,
    month: covered.month,
  }).amount;
}

/**
 * The skips, settled transfers and debited wallets the figure depends on.
 * From a month back: the transfer still in play is at most ten days old,
 * and the DCAs it covers are all ahead. `transferIds` are the templates
 * whose settled occurrences are read: by default the ones following.
 */
export async function readFollowFacts(
  db: Db,
  userId: string,
  today: string,
  templates: RecurringTemplateWithCategory[],
  transferIds: readonly string[] = templates
    .filter((template) => template.pricing_type === "purchases")
    .map((template) => template.id),
): Promise<FollowFacts | { error: string }> {
  const from = shiftIsoDate(today, -31);
  const nothing = Promise.resolve({ data: [], error: null });
  const [fulfilled, written, skipped, debited] = await Promise.all([
    transferIds.length > 0
      ? db
          .from("recurring_fulfilments")
          .select("template_id, occurred_on")
          .eq("user_id", userId)
          .in("template_id", transferIds)
          .gte("occurred_on", from)
      : nothing,
    transferIds.length > 0
      ? db
          .from("transactions")
          .select("recurring_template_id, occurred_on")
          .eq("user_id", userId)
          .in("recurring_template_id", transferIds)
          .gte("occurred_on", from)
      : nothing,
    db
      .from("recurring_skips")
      .select("template_id, occurred_on")
      .eq("user_id", userId)
      .gte("occurred_on", from),
    walletCategoriesTheBankDebits(db, userId),
  ]);
  for (const result of [fulfilled, written, skipped]) {
    if (result.error) {
      return { error: dbError(result.error) };
    }
  }

  return {
    templates,
    settledKeys: new Set([
      ...(
        (fulfilled.data ?? []) as { template_id: string; occurred_on: string }[]
      ).map((row) => recurringOccurrenceKey(row.template_id, row.occurred_on)),
      ...(
        (written.data ?? []) as {
          recurring_template_id: string | null;
          occurred_on: string;
        }[]
      ).map((row) =>
        recurringOccurrenceKey(row.recurring_template_id!, row.occurred_on),
      ),
    ]),
    skippedKeys: new Set(
      (skipped.data ?? []).map((row) =>
        recurringOccurrenceKey(row.template_id, row.occurred_on),
      ),
    ),
    debited,
  };
}

import type { ActionResult } from "@finance/core/action-result";
import { recurringOccurrenceKey } from "@finance/core/apply-recurring";
import {
  DEFAULT_CATEGORIES,
  getMonthBounds,
  shiftIsoDate,
} from "@finance/core/constants";
import {
  brokerTransferOf,
  canBeFundedByTransfer,
  dcaMonth,
  dcaNeedForMonth,
  isFundedDca,
  transferCoversMonth,
  transferReminder,
  type DcaMonth,
  type TransferReminder,
} from "@finance/core/dca-need";
import { DEFAULT_LOCALE, type Locale } from "@finance/core/i18n/locale";
import type { RecurringTemplateWithCategory } from "@finance/core/types/database";
import { parseUuid } from "@finance/core/validations/finance";

import { hasBankFeed, walletCategoriesTheBankDebits } from "./bank-feed";
import type { Db } from "./client";
import { dbError } from "./errors";
import { getBankForecast, getFulfilledKeys } from "./fulfilment";

/**
 * The app's transfer to the broker: the monthly charge that pays for the
 * DCAs ticked « Payé par le virement au courtier » (`funded_by_transfer`,
 * migration 055), kept by the app rather than by the user (`pricing_type =
 * 'purchases'`, migration 054). Due on the 1st, for the month it opens.
 */

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
  /** Transfer occurrences confirmed against the bank, or written. */
  settledKeys: Set<string>;
  /** Every skip from a month back, the DCAs' and the transfers'. */
  skippedKeys: Set<string>;
  /** `walletCategoriesTheBankDebits`. */
  debited: Set<string>;
}

/**
 * Keep the app's transfer in step with the ticks, and its figure with what
 * the month it covers needs (`dcaNeedForMonth`).
 *
 * With a DCA ticked, the transfer has to be there and running: made the
 * first time — their own monthly « Virement vers le courtier » taken over if
 * they have one, so it is not counted twice — and brought back if it was
 * paused. With none ticked, it is paused, not deleted, so its history
 * stays. Its figure is stored in its `amount`, the way a share-priced
 * template's last quote is: the forecast, the projection, the month's fill
 * and « C'est arrivé ? » read it without knowing how it was reached.
 *
 * Run where any of it can move: the daily quote refresh, the app opening, a
 * tick, and a charge, one of its days or a transfer's confirmation changing.
 * Only what differs is written, and it never throws: a figure a day stale is
 * not worth failing the change that asked for it.
 *
 * Returns the error, if a read or a write failed.
 */
export async function followPurchases(
  db: Db,
  userId: string,
  today: string,
): Promise<string | null> {
  try {
    const [all, debited] = await Promise.all([
      readTemplates(db, userId),
      walletCategoriesTheBankDebits(db, userId),
    ]);
    const funded = all.some((template) => isFundedDca(template, debited));
    let transfer = brokerTransferOf(all);

    if (!funded) {
      if (transfer?.active) {
        const { error } = await db
          .from("recurring_templates")
          .update({ active: false })
          .eq("id", transfer.id)
          .eq("user_id", userId);
        return error ? dbError(error) : null;
      }
      return null;
    }

    if (!transfer) {
      const made = await makeBrokerTransfer(db, userId, all);
      if ("error" in made) {
        return made.error;
      }
      transfer = made.transfer;
    } else if (!transfer.active) {
      const { error } = await db
        .from("recurring_templates")
        .update({ active: true })
        .eq("id", transfer.id)
        .eq("user_id", userId);
      if (error) {
        return dbError(error);
      }
      transfer = { ...transfer, active: true };
    }

    const active = all
      .filter((template) => template.active && template.id !== transfer.id)
      .concat(transfer);
    const facts = await readFollowFacts(db, userId, today, active, [
      transfer.id,
    ]);
    if ("error" in facts) {
      return facts.error;
    }
    const amount = followedAmount(transfer, facts, today);
    if (amount <= 0 || amount === Number(transfer.amount)) {
      return null;
    }
    const { error } = await db
      .from("recurring_templates")
      .update({ amount })
      .eq("id", transfer.id)
      .eq("user_id", userId);
    return error ? dbError(error) : null;
  } catch (error) {
    return error instanceof Error
      ? error.message
      : "actions.couldNotSaveRecurring";
  }
}

/**
 * Tick or untick « Payé par le virement au courtier » on a DCA, and bring
 * the app's transfer along (`followPurchases`). Only on a DCA bought at the
 * broker: a wallet the bank debits needs no transfer.
 */
export async function setFundedByTransfer(
  db: Db,
  userId: string,
  templateId: string,
  funded: boolean,
  today: string,
): Promise<ActionResult> {
  if (!parseUuid(templateId) || typeof funded !== "boolean") {
    return { error: "errors.invalidInput" };
  }
  const [{ data: template }, debited] = await Promise.all([
    db
      .from("recurring_templates")
      .select(
        "id, category_id, categories(name, type, icon, counts_toward_summary)",
      )
      .eq("id", templateId)
      .eq("user_id", userId)
      .maybeSingle(),
    walletCategoriesTheBankDebits(db, userId),
  ]);
  if (
    !template?.categories ||
    !canBeFundedByTransfer(
      template as Pick<
        RecurringTemplateWithCategory,
        "category_id" | "categories"
      >,
      debited,
    )
  ) {
    return { error: "actions.recurringNotFound" };
  }

  const { error } = await db
    .from("recurring_templates")
    .update({ funded_by_transfer: funded })
    .eq("id", templateId)
    .eq("user_id", userId);
  if (error) {
    return { error: dbError(error) };
  }
  await followPurchases(db, userId, today);
  return { success: true };
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
  try {
    const templates = (await readTemplates(db, userId)).filter(
      (template) => template.active,
    );
    const facts = await readFollowFacts(
      db,
      userId,
      today,
      templates,
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
 * What Le point's DCA card says today (`dcaMonth`): the transfer's month,
 * whether it was sent, the month's DCAs going through, and the months funded
 * in a row. Null when there is nothing to say, or it could not be read.
 */
export async function getDcaMonth(
  db: Db,
  userId: string,
  today: string,
): Promise<DcaMonth | null> {
  try {
    const templates = await readTemplates(db, userId);
    const transfer = brokerTransferOf(templates);
    if (!transfer?.active) {
      return null;
    }
    const debited = await walletCategoriesTheBankDebits(db, userId);
    const funded = templates
      .filter((template) => isFundedDca(template, debited))
      .map((template) => template.id);
    const year = Number(today.slice(0, 4));
    const month = Number(today.slice(5, 7));
    const from = getMonthBounds(
      month === 1 ? year - 1 : year,
      month === 1 ? 12 : month - 1,
    ).start;
    const to = getMonthBounds(
      month === 12 ? year + 1 : year,
      month === 12 ? 1 : month + 1,
    ).end;
    const nothing = Promise.resolve({ data: [], error: null });

    const [fulfilled, sent, written, skipped, paidKeys] = await Promise.all([
      // Every month the transfer was confirmed or written, for the run.
      db
        .from("recurring_fulfilments")
        .select("template_id, occurred_on")
        .eq("user_id", userId)
        .eq("template_id", transfer.id),
      db
        .from("transactions")
        .select("recurring_template_id, occurred_on")
        .eq("user_id", userId)
        .eq("recurring_template_id", transfer.id),
      funded.length > 0
        ? db
            .from("transactions")
            .select("recurring_template_id, occurred_on")
            .eq("user_id", userId)
            .in("recurring_template_id", funded)
            .gte("occurred_on", from)
            .lte("occurred_on", to)
        : nothing,
      db
        .from("recurring_skips")
        .select("template_id, occurred_on")
        .eq("user_id", userId)
        .gte("occurred_on", from)
        .lte("occurred_on", to),
      readPaidKeys(db, userId, templates, today, debited),
    ]);
    for (const result of [fulfilled, sent, written, skipped]) {
      if (result.error) {
        return null;
      }
    }
    const keysOf = (
      rows: readonly {
        template_id?: string;
        recurring_template_id?: string | null;
        occurred_on: string;
      }[],
    ) =>
      new Set(
        rows.map((row) =>
          recurringOccurrenceKey(
            (row.template_id ?? row.recurring_template_id)!,
            row.occurred_on,
          ),
        ),
      );

    return dcaMonth({
      templates,
      today,
      settledKeys: new Set([
        ...keysOf(fulfilled.data ?? []),
        ...keysOf(sent.data ?? []),
      ]),
      skippedKeys: keysOf(skipped.data ?? []),
      writtenKeys: keysOf(written.data ?? []),
      debited,
      paidKeys,
    });
  } catch {
    return null;
  }
}

/**
 * The income the bank has brought, or that was confirmed against it: what
 * tells that the salary a transfer is sent from is in (`paydayKeyOf`). Read
 * only with a bank feeding the ledger and an income charge to look for —
 * without one, nothing can say the salary came — and empty if it cannot be
 * read: the card and the reminder come on their day anyway.
 */
async function readPaidKeys(
  db: Db,
  userId: string,
  templates: readonly RecurringTemplateWithCategory[],
  today: string,
  debited: ReadonlySet<string>,
): Promise<Set<string>> {
  const active = templates.filter((template) => template.active);
  if (
    !active.some((template) => template.categories.type === "income") ||
    !(await hasBankFeed(db, userId))
  ) {
    return new Set();
  }
  try {
    const [fulfilled, forecast] = await Promise.all([
      getFulfilledKeys(db, userId),
      getBankForecast(db, userId, active, today, debited),
    ]);
    return new Set([...fulfilled, ...forecast.arrived]);
  } catch {
    return new Set();
  }
}

/**
 * The pushes for the transfer: the card while it is still to send, once the
 * salary is in and two days before the 1st.
 */
export async function getTransferReminder(
  db: Db,
  userId: string,
  today: string,
): Promise<TransferReminder | null> {
  return transferReminder(await getDcaMonth(db, userId, today), today);
}

/**
 * The skips, settled transfers and debited wallets the figure depends on.
 * From a month back: the transfer still in play is at most ten days old,
 * and the DCAs it covers are all ahead. `transferIds` are the templates
 * whose settled occurrences are read: by default the app's transfer.
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

/** Every charge, running or paused, with its category. */
async function readTemplates(
  db: Db,
  userId: string,
): Promise<RecurringTemplateWithCategory[]> {
  const { data, error } = await db
    .from("recurring_templates")
    .select("*, categories(name, type, icon, counts_toward_summary)")
    .eq("user_id", userId);
  if (error) {
    throw error;
  }
  return (data ?? []) as RecurringTemplateWithCategory[];
}

/** The default « Virement vers le courtier », in either language. */
const BROKER = DEFAULT_CATEGORIES.find(
  (category) =>
    category.type === "investment" &&
    "countsTowardSummary" in category &&
    category.countsTowardSummary === true,
)!;
const BROKER_NAMES = new Set(
  [BROKER.names.fr, BROKER.names.en].map((name) => name.toLowerCase()),
);

/**
 * The app's transfer, the first time a DCA is ticked: the user's own monthly
 * transfer in « Virement vers le courtier » taken over if there is one — it
 * is the same money, and two would count it twice — else a new one there,
 * the category made if it is missing. Due on the 1st; its figure is worked
 * out right after.
 */
async function makeBrokerTransfer(
  db: Db,
  userId: string,
  templates: readonly RecurringTemplateWithCategory[],
  locale: Locale = DEFAULT_LOCALE,
): Promise<{ transfer: RecurringTemplateWithCategory } | { error: string }> {
  const theirs = templates
    .filter(
      (template) =>
        template.active &&
        (template.recurrence ?? "monthly") === "monthly" &&
        template.pricing_type === "fixed" &&
        BROKER_NAMES.has(template.categories.name.trim().toLowerCase()),
    )
    .sort((a, b) => Number(b.amount) - Number(a.amount))[0];
  const managed = {
    pricing_type: "purchases" as const,
    day_of_month: 1,
    share_count: null,
    instrument_symbol: null,
    instrument_name: null,
    last_quote_price: null,
    last_quote_at: null,
  };

  if (theirs) {
    const { error } = await db
      .from("recurring_templates")
      .update(managed)
      .eq("id", theirs.id)
      .eq("user_id", userId);
    return error
      ? { error: dbError(error) }
      : { transfer: { ...theirs, ...managed } };
  }

  const category = await brokerCategory(db, userId, locale);
  if ("error" in category) {
    return category;
  }
  const { data, error } = await db
    .from("recurring_templates")
    .insert({
      user_id: userId,
      category_id: category.id,
      // A template cannot be zero; `followPurchases` works it out next.
      amount: 1,
      recurrence: "monthly",
      day_of_week: null,
      month_of_year: null,
      active: true,
      ...managed,
    })
    .select("*, categories(name, type, icon, counts_toward_summary)")
    .single();
  return error || !data
    ? { error: error ? dbError(error) : "actions.couldNotSaveRecurring" }
    : { transfer: data as RecurringTemplateWithCategory };
}

/**
 * Where the app's transfer goes: the default « Virement vers le courtier »
 * under either of its names, made now if it is missing — never another
 * investment the account pays, an assurance vie say, which is other money.
 */
async function brokerCategory(
  db: Db,
  userId: string,
  locale: Locale,
): Promise<{ id: string } | { error: string }> {
  const { data: categories, error } = await db
    .from("categories")
    .select("id, name")
    .eq("user_id", userId)
    .eq("type", "investment")
    .eq("counts_toward_summary", true);
  if (error) {
    return { error: dbError(error) };
  }
  const found = (categories ?? []).find((category) =>
    BROKER_NAMES.has(category.name.trim().toLowerCase()),
  );
  if (found) {
    return { id: found.id };
  }

  const { data: created, error: createError } = await db
    .from("categories")
    .insert({
      user_id: userId,
      name: BROKER.names[locale],
      type: "investment",
      icon: BROKER.icon,
      counts_toward_summary: true,
    })
    .select("id")
    .single();
  return createError || !created
    ? { error: createError ? dbError(createError) : "errors.invalidInput" }
    : { id: created.id };
}

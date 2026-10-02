import {
  recurringOccurrenceKey,
  scheduleDatesBefore,
} from "@finance/core/apply-recurring";
import {
  getCurrentMonth,
  getMonthBounds,
  shiftIsoDate,
  todayIsoLocal,
} from "@finance/core/constants";
import {
  BITCOIN_INSTRUMENT,
  isCryptoCategoryName,
} from "@finance/core/crypto-holdings";
import { resolveRecurringAmount } from "@finance/core/recurring-shares";
import type { Database } from "@finance/core/types/database";
import type { RecurringTemplateInput } from "@finance/core/validations/finance";

import { hasBankFeed } from "./bank-feed";
import type { Db } from "./client";
import { quoteSource } from "./quote-source";
import { fillMonth, followTemplate } from "./recurring-apply";
import { syncInvestmentPositionFromRecurring } from "./recurring-positions";
import { dbError } from "./errors";

type TemplateInsert =
  Database["public"]["Tables"]["recurring_templates"]["Insert"];
type TemplateUpdate =
  Database["public"]["Tables"]["recurring_templates"]["Update"];

export interface SaveTemplateOptions {
  /**
   * A new template whose occurrences this month have already happened: write
   * them, rather than starting from the next date to come.
   */
  startThisMonth?: boolean;
  /**
   * An edit that reaches this month's rows already written ("this month
   * too") rather than only the ones still to come ("upcoming only").
   */
  applyToThisMonth?: boolean;
}

/** The first day of the month in progress. */
function firstOfCurrentMonth(): string {
  const { year, month } = getCurrentMonth();
  return getMonthBounds(year, month).start;
}

/**
 * Create or change a recurring template, and bring the ledger in line with
 * it.
 *
 * Shared by the web's action and the phone's mutation, which were the same
 * two hundred lines with different plumbing; each now parses its own input
 * (a form, an object) with `recurringTemplateSchema` and hands the result
 * here.
 *
 * A share-priced template is priced from the market as it is saved, so its
 * stored amount — what projections and the recurring list read — is right
 * from the first moment. A fixed template in a crypto category is pinned to
 * bitcoin, the one instrument such a category tracks. Then the position it
 * feeds is synced, and unless a bank feeds the ledger (where templates only
 * forecast), the rows it has written follow: a new template writes this
 * month's past occurrences only when asked to, an edit reaches this month's
 * rows only when asked to, and a change of schedule reschedules.
 *
 * The ledger following is best-effort: a save that worked is not undone by
 * it, and the month fills itself again the next time either app opens.
 */
export async function saveRecurringTemplate(
  db: Db,
  userId: string,
  data: RecurringTemplateInput,
  options: SaveTemplateOptions = {},
): Promise<{ templateId: string } | { error: string }> {
  let amount = data.amount ?? 0;
  let pricing: Pick<
    TemplateInsert,
    | "pricing_type"
    | "share_count"
    | "instrument_symbol"
    | "instrument_name"
    | "last_quote_price"
    | "last_quote_at"
  >;

  if (data.pricingType === "shares") {
    try {
      const resolved = await resolveRecurringAmount(
        {
          pricing_type: "shares",
          amount: 0,
          share_count: data.shareCount ?? null,
          instrument_symbol: data.instrumentSymbol ?? null,
          instrument_name: data.instrumentName ?? null,
          description: data.description ?? null,
          last_quote_price: null,
        },
        quoteSource,
      );
      amount = resolved.amount;
      pricing = {
        pricing_type: "shares",
        share_count: data.shareCount ?? null,
        instrument_symbol: data.instrumentSymbol ?? null,
        instrument_name: data.instrumentName ?? null,
        last_quote_price: resolved.quoteUpdate?.last_quote_price ?? null,
        last_quote_at: resolved.quoteUpdate?.last_quote_at ?? null,
      };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : "actions.couldNotPrice",
      };
    }
  } else {
    pricing = {
      pricing_type: "fixed",
      share_count: null,
      instrument_symbol: data.instrumentSymbol?.trim() || null,
      instrument_name: data.instrumentName?.trim() || null,
      last_quote_price: null,
      last_quote_at: null,
    };
  }

  // Filtered by owner as well as by row level security: the web action used
  // to read any category by id and rely on RLS alone.
  const { data: category } = await db
    .from("categories")
    .select("name")
    .eq("id", data.categoryId)
    .eq("user_id", userId)
    .maybeSingle();

  if (
    category &&
    isCryptoCategoryName(category.name) &&
    data.pricingType === "fixed"
  ) {
    pricing.instrument_symbol = BITCOIN_INSTRUMENT.symbol;
    pricing.instrument_name = BITCOIN_INSTRUMENT.name;
  }

  const schedule: Pick<
    TemplateInsert,
    "recurrence" | "day_of_month" | "day_of_week" | "month_of_year"
  > =
    data.recurrence === "monthly"
      ? {
          recurrence: "monthly",
          day_of_month: data.dayOfMonth,
          day_of_week: null,
          month_of_year: null,
        }
      : data.recurrence === "weekly"
        ? {
            recurrence: "weekly",
            day_of_month: null,
            day_of_week: data.dayOfWeek,
            month_of_year: null,
          }
        : {
            recurrence: "yearly",
            month_of_year: data.monthOfYear,
            day_of_month: data.dayOfMonth,
            day_of_week: null,
          };

  const fields = {
    category_id: data.categoryId,
    amount,
    active: data.active ?? true,
    description: data.description?.trim() || null,
    starts_on: data.startsOn ?? null,
    ends_on: data.endsOn ?? null,
    // Only when the form asked: a save that did not is not a detach.
    ...(data.propertyId !== undefined ? { property_id: data.propertyId } : {}),
    ...pricing,
    ...schedule,
  };

  // What the template said before this save, so the rows it already wrote
  // can tell whether they have been moved to another day or stopped.
  const { data: previous } = data.id
    ? await db
        .from("recurring_templates")
        .select(
          "recurrence, day_of_month, day_of_week, month_of_year, starts_on, ends_on, active",
        )
        .eq("id", data.id)
        .eq("user_id", userId)
        .maybeSingle()
    : { data: null };

  let templateId: string;
  if (data.id) {
    const update: TemplateUpdate = fields;
    const { error } = await db
      .from("recurring_templates")
      .update(update)
      .eq("id", data.id)
      .eq("user_id", userId);

    if (error) {
      return { error: dbError(error) };
    }
    templateId = data.id;
  } else {
    const insert: TemplateInsert = { user_id: userId, ...fields };
    const { data: inserted, error } = await db
      .from("recurring_templates")
      .insert(insert)
      .select("id")
      .single();

    if (error || !inserted) {
      return {
        error: error ? dbError(error) : "actions.couldNotSaveRecurring",
      };
    }
    templateId = inserted.id;
  }

  await syncInvestmentPositionFromRecurring(db, userId, templateId);

  if (await hasBankFeed(db, userId)) {
    return { templateId };
  }

  const today = todayIsoLocal();
  try {
    if (previous === null) {
      if (options.startThisMonth) {
        const { year, month } = getCurrentMonth();
        await fillMonth(
          db,
          userId,
          year,
          month,
          today,
          new Set(
            scheduleDatesBefore(
              {
                recurrence: data.recurrence,
                day_of_month: schedule.day_of_month ?? null,
                day_of_week: schedule.day_of_week ?? null,
                month_of_year: schedule.month_of_year ?? null,
                starts_on: fields.starts_on,
                ends_on: fields.ends_on,
              },
              year,
              month,
              today,
            ).map((date) => recurringOccurrenceKey(templateId, date)),
          ),
        );
      }
    } else {
      const reschedule =
        previous.recurrence !== schedule.recurrence ||
        previous.day_of_month !== (schedule.day_of_month ?? null) ||
        previous.day_of_week !== (schedule.day_of_week ?? null) ||
        previous.month_of_year !== (schedule.month_of_year ?? null) ||
        previous.starts_on !== fields.starts_on ||
        previous.ends_on !== fields.ends_on ||
        previous.active !== fields.active;

      // "Apply this change to": this month too reaches back to its first
      // day, upcoming only starts tomorrow. Nothing reaches a past month.
      await followTemplate(db, userId, templateId, {
        today,
        from: options.applyToThisMonth
          ? firstOfCurrentMonth()
          : shiftIsoDate(today, 1),
        reschedule,
      });
    }
  } catch {
    // See above: the save stands, and the next open fills the month.
  }

  return { templateId };
}

import {
  formatDayMonth,
  formatShortDate,
  isoDateInAppTimeZone,
} from "./constants";
import { type Locale } from "./i18n/locale";
import { translator } from "./i18n/t";
import { displayNameForRecurringTemplate } from "./investment-positions";
import type { QuoteSource } from "./market/quote-source";
import {
  filterDatesBySchedule,
  getRecurringOccurrenceDates,
} from "./recurrence";
import { isQuotePriced, resolveRecurringAmount } from "./recurring-shares";
import type {
  CategoryType,
  RecurringTemplateWithCategory,
} from "./types/database";

export interface RecurringOccurrencePlan {
  templateId: string;
  name: string;
  dateLabel: string;
  occurredOn: string;
  amount: number;
  note: string | null;
  categoryId: string;
  /**
   * True when this amount came off an instrument quote rather than a figure
   * the user typed. Such an amount moves on its own, which is what decides
   * whether a difference is worth anyone's attention.
   */
  pricedFromQuote: boolean;
}

export interface RecurringOccurrenceUpdate extends RecurringOccurrencePlan {
  transactionId: string;
  previousAmount: number;
  previousNote: string | null;
  previousCategoryId: string;
}

export interface ApplyRecurringPlan {
  toCreate: RecurringOccurrencePlan[];
  /**
   * Differences that come from the user editing a template. Written only
   * when that edit is saved, and only to rows still dated ahead — see
   * `followTemplateUpdates`. A run that merely fills the month leaves them
   * alone, because a row the user corrected by hand also shows up here.
   */
  toUpdate: RecurringOccurrenceUpdate[];
  /**
   * Quote-priced occurrences, already applied, still dated ahead. Nobody
   * decided these and nobody is asked about them: whoever runs an apply
   * writes them through.
   */
  toReprice: RecurringOccurrenceUpdate[];
}

interface ExistingRecurringTx {
  id: string;
  amount: number;
  note: string | null;
  category_id: string;
}

function amountsDiffer(left: number, right: number): boolean {
  return Math.abs(left - right) > 0.009;
}

function notesDiffer(
  left: string | null | undefined,
  right: string | null | undefined,
): boolean {
  return (left?.trim() ?? "") !== (right?.trim() ?? "");
}

function transactionDiffers(
  existing: ExistingRecurringTx,
  plan: RecurringOccurrencePlan,
): boolean {
  return (
    amountsDiffer(Number(existing.amount), plan.amount) ||
    notesDiffer(existing.note, plan.note) ||
    existing.category_id !== plan.categoryId
  );
}

/** Key used for applied txs and month skips: templateId:YYYY-MM-DD */
export function recurringOccurrenceKey(
  templateId: string,
  occurredOn: string,
): string {
  return `${templateId}:${occurredOn}`;
}

/**
 * Whether an applied occurrence is still a forecast rather than something
 * that happened. Today counts as ahead: the day is not over, and a charge
 * falling on it may not have left yet. What repricing goes by.
 */
export function isForecast(occurredOn: string, today: string): boolean {
  return occurredOn >= today;
}

/**
 * Whether an occurrence is still planned: its day has not come.
 *
 * A planned occurrence is never stored. The ledger draws it from the template
 * — which is why editing a charge changes every month ahead at once — and it
 * becomes a transaction on its day. Today is not planned: today's charges are
 * written this morning.
 */
export function isPlanned(occurredOn: string, today: string): boolean {
  return occurredOn > today;
}

/** The day a template was set up, in the app's calendar. */
export function templateSetUpOn(
  template: Pick<RecurringTemplateWithCategory, "created_at">,
): string {
  return template.created_at
    ? isoDateInAppTimeZone(template.created_at)
    : "0000-01-01";
}

/**
 * Whether filling may write an occurrence: its day has come, and it is not
 * from before the template existed.
 *
 * The second half is what lets a fill look back past the month boundary
 * safely. A charge set up on the 20th with the 5th as its day has not been
 * missed on the 5th — it did not exist — so it starts with the next 5th, and
 * writing this month's is something the user asks for when they create it.
 */
export function isDue(
  template: Pick<RecurringTemplateWithCategory, "created_at">,
  occurredOn: string,
  today: string,
): boolean {
  return occurredOn <= today && occurredOn >= templateSetUpOn(template);
}

export interface ApplyRecurringDeps {
  /** Prices for share-priced templates. */
  quotes: QuoteSource;
  /** The reader's language, for the date labels the plan carries. */
  locale: Locale;
  /** Occurrence keys the user chose to skip this month. */
  skippedKeys?: Set<string>;
  /**
   * Today, ISO. Separates an applied occurrence that is still a forecast from
   * one that has already happened.
   */
  today: string;
  /**
   * When set, only occurrences due by this day are planned for creation — see
   * `isDue`. What filling a month passes; comparing rows against their
   * template does not, because a row can exist for any day.
   */
  dueBy?: string;
}

/**
 * Every occurrence a month's templates call for, once skips are taken out.
 *
 * Shared by the plan below and by `countRecurringToApply`, so that "which
 * occurrences exist this month" is decided in one place. The count and the
 * plan disagreeing would be worse than either being wrong on its own: the
 * badge would promise a number of rows the apply sheet then did not offer.
 */
function* monthOccurrences(
  templates: readonly RecurringTemplateWithCategory[],
  year: number,
  month: number,
  skippedKeys: ReadonlySet<string>,
): Generator<{
  template: RecurringTemplateWithCategory;
  occurredOn: string;
  key: string;
}> {
  for (const template of templates) {
    if (!template.active) {
      continue;
    }

    const occurrenceDates = filterDatesBySchedule(
      getRecurringOccurrenceDates(
        {
          recurrence: template.recurrence ?? "monthly",
          day_of_month: template.day_of_month,
          day_of_week: template.day_of_week,
          month_of_year: template.month_of_year,
        },
        year,
        month,
      ),
      template.starts_on,
      template.ends_on,
    );

    for (const occurredOn of occurrenceDates) {
      const key = recurringOccurrenceKey(template.id, occurredOn);
      if (skippedKeys.has(key)) {
        continue;
      }
      yield { template, occurredOn, key };
    }
  }
}

/**
 * How many rows a month's templates are waiting to write — without pricing
 * a single one of them.
 *
 * The month fills itself every time the app opens, so the question "is
 * anything missing?" is asked on nearly every visit and answered "no" on
 * nearly all of them. Asking `buildApplyRecurringPlan` instead costs a live
 * market quote per priced occurrence to reach that same "no". Nothing about
 * whether a template has written its row this month depends on what the row
 * would say, so the plan is only built once this says there is something to
 * write.
 *
 * Deliberately only `toCreate`'s count. `toUpdate` is a genuine comparison
 * of amounts and notes against what is already recorded, which cannot be
 * answered without resolving those amounts, and filling a month never
 * writes it anyway.
 */
export function countRecurringToApply(
  templates: readonly RecurringTemplateWithCategory[],
  existingKeys: ReadonlySet<string>,
  year: number,
  month: number,
  skippedKeys: ReadonlySet<string> = new Set<string>(),
  dueBy?: string,
): number {
  let waiting = 0;
  for (const { template, occurredOn, key } of monthOccurrences(
    templates,
    year,
    month,
    skippedKeys,
  )) {
    if (dueBy !== undefined && !isDue(template, occurredOn, dueBy)) {
      continue;
    }
    if (!existingKeys.has(key)) {
      waiting += 1;
    }
  }
  return waiting;
}

/**
 * What a month's templates call for, sorted by what may write it.
 *
 * `toCreate` is written by anything that fills the month. The other two are
 * differences against rows already written, and they are kept apart because
 * they have different causes.
 *
 * A quote-priced occurrence differs from a freshly built plan almost always —
 * an ETF ticks between two page loads — and nobody made that happen. While
 * its date is still ahead the amount is a forecast, so it is corrected on its
 * own: `toReprice`. Once its date has passed it is settled: that much money
 * moved at that price, and a later quote does not change what happened. A
 * reclassification still reaches it, without touching the settled figure.
 *
 * A fixed amount is different in kind. It only differs because someone edited
 * something — the template, or the row itself — so `toUpdate` is only written
 * when the template is saved, and then only ahead of today. See
 * `followTemplateUpdates`.
 */
export async function buildApplyRecurringPlan(
  templates: RecurringTemplateWithCategory[],
  existingByKey: Map<string, ExistingRecurringTx>,
  year: number,
  month: number,
  deps: ApplyRecurringDeps,
): Promise<ApplyRecurringPlan> {
  const {
    quotes,
    skippedKeys = new Set<string>(),
    today,
    dueBy,
    locale,
  } = deps;
  const toCreate: RecurringOccurrencePlan[] = [];
  const toUpdate: RecurringOccurrenceUpdate[] = [];
  const toReprice: RecurringOccurrenceUpdate[] = [];

  for (const { template, occurredOn, key } of monthOccurrences(
    templates,
    year,
    month,
    skippedKeys,
  )) {
    const existing = existingByKey.get(key);

    // Not written and not due: nothing to plan, and nothing worth a quote.
    if (
      !existing &&
      dueBy !== undefined &&
      !isDue(template, occurredOn, dueBy)
    ) {
      continue;
    }

    const pricedFromQuote = isQuotePriced({
      pricing_type: template.pricing_type ?? "fixed",
      share_count: template.share_count,
      instrument_symbol: template.instrument_symbol,
    });

    let amount = Number(template.amount);
    let note = template.description?.trim() || null;

    try {
      const resolved = await resolveRecurringAmount(
        {
          pricing_type: template.pricing_type ?? "fixed",
          amount: Number(template.amount),
          share_count: template.share_count,
          instrument_symbol: template.instrument_symbol,
          instrument_name: template.instrument_name,
          description: template.description,
          last_quote_price: template.last_quote_price,
        },
        quotes,
      );
      amount = resolved.amount;
      note = resolved.note;
    } catch {
      continue;
    }

    const plan: RecurringOccurrencePlan = {
      templateId: template.id,
      name: displayNameForRecurringTemplate(template),
      dateLabel: formatShortDate(occurredOn, locale),
      occurredOn,
      amount,
      note,
      categoryId: template.category_id,
      pricedFromQuote,
    };

    if (!existing) {
      toCreate.push(plan);
      continue;
    }

    if (!transactionDiffers(existing, plan)) {
      continue;
    }

    const update: RecurringOccurrenceUpdate = {
      ...plan,
      transactionId: existing.id,
      previousAmount: Number(existing.amount),
      previousNote: existing.note,
      previousCategoryId: existing.category_id,
    };

    if (!plan.pricedFromQuote) {
      toUpdate.push(update);
      continue;
    }

    if (isForecast(occurredOn, today)) {
      toReprice.push(update);
      continue;
    }

    // Settled. The price it was bought at stands; only a move to another
    // category is still worth applying, and it leaves the figure alone.
    if (existing.category_id !== plan.categoryId) {
      toUpdate.push({
        ...update,
        amount: Number(existing.amount),
        note: existing.note,
      });
    }
  }

  return { toCreate, toUpdate, toReprice };
}

/**
 * Every occurrence a month's templates call for, skips taken out, as keys.
 *
 * What a charge's rows still dated ahead are checked against once the charge
 * itself has changed: a row whose key is not in here is a forecast the charge
 * no longer makes.
 */
export function calledForKeys(
  templates: readonly RecurringTemplateWithCategory[],
  year: number,
  month: number,
  skippedKeys: ReadonlySet<string> = new Set<string>(),
): Set<string> {
  const keys = new Set<string>();
  for (const { key } of monthOccurrences(templates, year, month, skippedKeys)) {
    keys.add(key);
  }
  return keys;
}

/**
 * What saving a template changes about the rows it has already written, from
 * a given day on.
 *
 * `from` is the user's answer to "apply this change to…": tomorrow for
 * upcoming only, the first of the month for this month too. Rows dated
 * before it are what happened and keep what they say — raising the rent today
 * does not rewrite what was paid on the 5th unless the user says it should.
 * Rows from it on follow the template: amount, note and category.
 *
 * Only ever run when the template is saved. `toUpdate` also holds rows the
 * user corrected by hand, and nothing else may undo those.
 */
export function followTemplateUpdates(
  plan: ApplyRecurringPlan,
  templateId: string,
  from: string,
): RecurringOccurrenceUpdate[] {
  return [...plan.toUpdate, ...plan.toReprice].filter(
    (update) => update.templateId === templateId && update.occurredOn >= from,
  );
}

/**
 * Occurrences a template calls for on days that have come, today included,
 * that nothing has written — what a rescheduled or re-activated template would
 * otherwise backfill.
 *
 * Moving the rent from the 5th to the 10th on the 12th means next month's
 * rent is on the 10th, not that this month had a second one. The month's
 * occurrence already happened on the old day, so the new schedule's days that
 * have come are recorded as skipped rather than left for the month to fill.
 * Switching a charge back on means the same: it starts again from tomorrow.
 * A brand-new template needs none of this — `isDue` already starts it on the
 * day it was set up.
 */
export function pastOccurrencesNotWritten(
  templates: readonly RecurringTemplateWithCategory[],
  existingKeys: ReadonlySet<string>,
  year: number,
  month: number,
  skippedKeys: ReadonlySet<string>,
  today: string,
): { templateId: string; occurredOn: string }[] {
  const out: { templateId: string; occurredOn: string }[] = [];
  for (const { template, occurredOn, key } of monthOccurrences(
    templates,
    year,
    month,
    skippedKeys,
  )) {
    if (occurredOn <= today && !existingKeys.has(key)) {
      out.push({ templateId: template.id, occurredOn });
    }
  }
  return out;
}

/** One row a template wrote, as much of it as deciding its fate needs. */
export interface TemplateRow {
  id: string;
  templateId: string;
  occurredOn: string;
}

/**
 * Rows dated after today that their template no longer calls for — after it
 * was switched off, deleted, or moved to another day. Only rows written ahead
 * before occurrences were planned rather than stored can be in this state.
 *
 * Rows dated today or earlier are never in here, whatever the template now
 * says: they are the record of what happened. And the caller decides when to ask. A row the
 * user moved to another date is not called for either, which is why this is
 * only consulted when the template's own schedule, or its existence, changed.
 */
export function forecastsNoLongerCalledFor(
  rows: readonly TemplateRow[],
  calledFor: ReadonlySet<string>,
  today: string,
): string[] {
  return rows
    .filter(
      (row) =>
        isPlanned(row.occurredOn, today) &&
        !calledFor.has(recurringOccurrenceKey(row.templateId, row.occurredOn)),
    )
    .map((row) => row.id);
}

/** One occurrence still to come, drawn from its template rather than stored. */
export interface PlannedOccurrence {
  templateId: string;
  occurredOn: string;
  /** `templateId:YYYY-MM-DD`, the same key a written row and a skip use. */
  key: string;
  name: string;
  /**
   * The template's stored amount. A share-priced one is kept at the latest
   * quote by the daily run, and the row written on the day is priced then.
   */
  amount: number;
  note: string | null;
  categoryId: string;
  categoryName: string;
  categoryType: CategoryType;
  categoryIcon: string | null;
}

/**
 * What a month's charges still have to bring, for the ledger to draw as
 * planned rows.
 *
 * Every occurrence dated after today that is neither written, skipped nor
 * already fulfilled by another row. Nothing here is stored — which is the
 * whole reason a future month can show its charges without anything having
 * to be kept in step when a charge changes.
 */
export function plannedOccurrences(
  templates: readonly RecurringTemplateWithCategory[],
  existingKeys: ReadonlySet<string>,
  year: number,
  month: number,
  skippedKeys: ReadonlySet<string>,
  today: string,
): PlannedOccurrence[] {
  const planned: PlannedOccurrence[] = [];
  for (const { template, occurredOn, key } of monthOccurrences(
    templates,
    year,
    month,
    skippedKeys,
  )) {
    if (!isPlanned(occurredOn, today) || existingKeys.has(key)) {
      continue;
    }
    planned.push({
      templateId: template.id,
      occurredOn,
      key,
      name: displayNameForRecurringTemplate(template),
      amount: Number(template.amount),
      note: template.description?.trim() || null,
      categoryId: template.category_id,
      categoryName: template.categories.name,
      categoryType: template.categories.type,
      categoryIcon: template.categories.icon,
    });
  }
  return planned.sort((a, b) => a.occurredOn.localeCompare(b.occurredOn));
}

/**
 * The days a schedule falls on this month that are already behind today —
 * what "include this month" would record for a charge being created.
 */
export function scheduleDatesBefore(
  schedule: {
    recurrence: RecurringTemplateWithCategory["recurrence"];
    day_of_month: number | null;
    day_of_week: number | null;
    month_of_year: number | null;
    starts_on: string | null;
    ends_on: string | null;
  },
  year: number,
  month: number,
  today: string,
): string[] {
  return filterDatesBySchedule(
    getRecurringOccurrenceDates(
      {
        recurrence: schedule.recurrence ?? "monthly",
        day_of_month: schedule.day_of_month,
        day_of_week: schedule.day_of_week,
        month_of_year: schedule.month_of_year,
      },
      year,
      month,
    ),
    schedule.starts_on,
    schedule.ends_on,
  ).filter((date) => date < today);
}

/**
 * A few occurrence dates as one phrase — "5 Sep", "5 Sep and 12 Sep",
 * "5 Sep, 12 Sep and 19 Sep" — for the sentences that say which rows a
 * choice would touch.
 */
export function formatOccurrenceDates(
  dates: readonly string[],
  locale: Locale,
): string {
  const labels = dates.map((date) => formatDayMonth(date, locale));
  if (labels.length <= 1) {
    return labels[0] ?? "";
  }
  return translator(locale)("list.conjunction", {
    first: labels.slice(0, -1).join(", "),
    last: labels[labels.length - 1]!,
  });
}

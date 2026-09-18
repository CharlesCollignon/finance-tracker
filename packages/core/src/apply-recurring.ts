import { formatShortDate } from "./constants";
import { displayNameForRecurringTemplate } from "./investment-positions";
import type { QuoteSource } from "./market/quote-source";
import {
  filterDatesBySchedule,
  getRecurringOccurrenceDates,
} from "./recurrence";
import { isQuotePriced, resolveRecurringAmount } from "./recurring-shares";
import type { RecurringTemplateWithCategory } from "./types/database";

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
  /** Differences that are somebody's decision, so somebody has to confirm. */
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

export interface ApplyRecurringDeps {
  /** Prices for share-priced templates. */
  quotes: QuoteSource;
  /** Occurrence keys the user chose to skip this month. */
  skippedKeys?: Set<string>;
  /**
   * Today, ISO. Separates an applied occurrence that is still a forecast from
   * one that has already happened.
   */
  today: string;
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
 * The home screen's action row needs a count, not a plan. Asking
 * `buildApplyRecurringPlan` for one costs a live market quote per priced
 * occurrence, on the landing page, every load — and the answer it gives back
 * is *worse*: a quote that cannot be fetched makes that occurrence vanish
 * from `toCreate` entirely, so a reader with a broken network is told fewer
 * charges are waiting than actually are. Nothing about whether a template
 * has written its row this month depends on what the row would say.
 *
 * Deliberately only `toCreate`'s count. `toUpdate` is a genuine comparison
 * of amounts and notes against what is already recorded, which cannot be
 * answered without resolving those amounts; it is also not what the action
 * row claims. See `applyRecurringPlanCounts` for the badge that does count
 * both, from a plan that has already been built for other reasons.
 */
export function countRecurringToApply(
  templates: readonly RecurringTemplateWithCategory[],
  existingKeys: ReadonlySet<string>,
  year: number,
  month: number,
  skippedKeys: ReadonlySet<string> = new Set<string>(),
): number {
  let waiting = 0;
  for (const { key } of monthOccurrences(templates, year, month, skippedKeys)) {
    if (!existingKeys.has(key)) {
      waiting += 1;
    }
  }
  return waiting;
}

/**
 * What a month's templates call for, sorted by who owes a decision.
 *
 * A quote-priced occurrence differs from a freshly built plan almost always —
 * an ETF ticks between two page loads — and routing that into `toUpdate`
 * turns a pending badge into wallpaper: the user is asked, every day, to
 * rubber-stamp the market. So a difference is only theirs to confirm when
 * they are the reason for it.
 *
 * Once its date has passed, a quote-priced occurrence is settled: that much
 * money moved at that price, and a later quote does not change what happened.
 * A reclassification still needs applying, and does so without touching the
 * settled figure. While the date is still ahead the amount is a forecast, so
 * it is corrected on its own — `toReprice`.
 *
 * A fixed amount is different in kind. It only moves because the template was
 * edited, and whether that reaches occurrences already applied is genuinely
 * the user's call.
 */
export async function buildApplyRecurringPlan(
  templates: RecurringTemplateWithCategory[],
  existingByKey: Map<string, ExistingRecurringTx>,
  year: number,
  month: number,
  deps: ApplyRecurringDeps,
): Promise<ApplyRecurringPlan> {
  const { quotes, skippedKeys = new Set<string>(), today } = deps;
  const toCreate: RecurringOccurrencePlan[] = [];
  const toUpdate: RecurringOccurrenceUpdate[] = [];
  const toReprice: RecurringOccurrenceUpdate[] = [];

  for (const { template, occurredOn, key } of monthOccurrences(
    templates,
    year,
    month,
    skippedKeys,
  )) {
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
      dateLabel: formatShortDate(occurredOn),
      occurredOn,
      amount,
      note,
      categoryId: template.category_id,
      pricedFromQuote,
    };

    const existing = existingByKey.get(key);

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

    if (occurredOn >= today) {
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
 * How much of a plan is waiting on the user — what a pending badge counts.
 * Repricing is deliberately absent: it is not waiting on anyone.
 */
export function applyRecurringPlanCounts(plan: ApplyRecurringPlan): {
  creates: number;
  updates: number;
} {
  return {
    creates: plan.toCreate.length,
    updates: plan.toUpdate.length,
  };
}

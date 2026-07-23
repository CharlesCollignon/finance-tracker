import { formatShortDate } from "./constants";
import { displayNameForRecurringTemplate } from "./investment-positions";
import { getRecurringOccurrenceDates } from "./recurrence";
import { resolveRecurringAmount } from "./recurring-shares";
import type { RecurringTemplateWithCategory } from "./types/database";

export interface RecurringOccurrencePlan {
  templateId: string;
  name: string;
  dateLabel: string;
  occurredOn: string;
  amount: number;
  note: string | null;
  categoryId: string;
}

export interface RecurringOccurrenceUpdate extends RecurringOccurrencePlan {
  transactionId: string;
  previousAmount: number;
  previousNote: string | null;
}

export interface ApplyRecurringPlan {
  toCreate: RecurringOccurrencePlan[];
  toUpdate: RecurringOccurrenceUpdate[];
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

export async function buildApplyRecurringPlan(
  templates: RecurringTemplateWithCategory[],
  existingByKey: Map<string, ExistingRecurringTx>,
  year: number,
  month: number,
): Promise<ApplyRecurringPlan> {
  const toCreate: RecurringOccurrencePlan[] = [];
  const toUpdate: RecurringOccurrenceUpdate[] = [];

  for (const template of templates) {
    if (!template.active) {
      continue;
    }

    const occurrenceDates = getRecurringOccurrenceDates(
      {
        recurrence: template.recurrence ?? "monthly",
        day_of_month: template.day_of_month,
        day_of_week: template.day_of_week,
        month_of_year: template.month_of_year,
      },
      year,
      month,
    );

    for (const occurredOn of occurrenceDates) {
      let amount = Number(template.amount);
      let note = template.description?.trim() || null;

      try {
        const resolved = await resolveRecurringAmount({
          pricing_type: template.pricing_type ?? "fixed",
          amount: Number(template.amount),
          share_count: template.share_count,
          instrument_symbol: template.instrument_symbol,
          instrument_name: template.instrument_name,
          description: template.description,
          last_quote_price: template.last_quote_price,
        });
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
      };

      const existing = existingByKey.get(`${template.id}:${occurredOn}`);

      if (!existing) {
        toCreate.push(plan);
        continue;
      }

      if (transactionDiffers(existing, plan)) {
        toUpdate.push({
          ...plan,
          transactionId: existing.id,
          previousAmount: Number(existing.amount),
          previousNote: existing.note,
        });
      }
    }
  }

  return { toCreate, toUpdate };
}

export function applyRecurringPlanCounts(plan: ApplyRecurringPlan): {
  creates: number;
  updates: number;
} {
  return {
    creates: plan.toCreate.length,
    updates: plan.toUpdate.length,
  };
}

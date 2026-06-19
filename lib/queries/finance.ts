import { createClient } from "@/lib/supabase/server";
import { getMonthBounds, type BudgetViewMode } from "@/lib/constants";
import { buildMonthlySummary } from "@/lib/monthly-summary";
import type {
  MonthlySummary,
  RecurringTemplateWithCategory,
  TransactionWithCategory,
} from "@/lib/types/database";

export async function getTransactions(
  userId: string,
  year: number,
  month: number,
): Promise<TransactionWithCategory[]> {
  const supabase = await createClient();
  const { start, end } = getMonthBounds(year, month);

  const { data, error } = await supabase
    .from("transactions")
    .select(
      "*, categories(name, type, icon, counts_toward_summary)",
    )
    .eq("user_id", userId)
    .gte("occurred_on", start)
    .lte("occurred_on", end)
    .order("occurred_on", { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []) as TransactionWithCategory[];
}

export async function getInvestmentTransactions(
  userId: string,
): Promise<TransactionWithCategory[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("transactions")
    .select(
      "*, categories!inner(name, type, icon, counts_toward_summary)",
    )
    .eq("user_id", userId)
    .eq("categories.type", "investment")
    .order("occurred_on", { ascending: true });

  if (error) {
    throw error;
  }

  return (data ?? []) as TransactionWithCategory[];
}

export async function getMonthlySummary(
  userId: string,
  year: number,
  month: number,
  view: BudgetViewMode = "current",
): Promise<MonthlySummary> {
  const [transactions, recurringTemplates] = await Promise.all([
    getTransactions(userId, year, month),
    getRecurringTemplates(userId),
  ]);

  return buildMonthlySummary(
    transactions,
    recurringTemplates,
    year,
    month,
    view,
  );
}

export async function getRecurringTemplates(
  userId: string,
): Promise<RecurringTemplateWithCategory[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("recurring_templates")
    .select(
      "*, categories(name, type, icon, counts_toward_summary)",
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

  if (error) {
    throw error;
  }

  return (data ?? []) as RecurringTemplateWithCategory[];
}

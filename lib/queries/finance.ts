import { createClient } from "@/lib/supabase/server";
import { getMonthBounds } from "@/lib/constants";
import type {
  CategoryBreakdown,
  MonthlySummary,
  RecurringTemplateWithCategory,
  TransactionWithCategory,
} from "@/lib/types/database";

function buildBreakdown(
  rows: {
    category_id: string;
    amount: number;
    categories: {
      name: string;
      type: string;
      icon: string | null;
    };
  }[],
): CategoryBreakdown[] {
  const map = new Map<string, CategoryBreakdown>();

  for (const row of rows) {
    const existing = map.get(row.category_id);
    if (existing) {
      existing.total += Number(row.amount);
    } else {
      map.set(row.category_id, {
        categoryId: row.category_id,
        name: row.categories.name,
        type: row.categories.type as CategoryBreakdown["type"],
        icon: row.categories.icon,
        total: Number(row.amount),
      });
    }
  }

  return Array.from(map.values()).sort((a, b) => b.total - a.total);
}

function countsTowardSummary(
  tx: TransactionWithCategory,
): boolean {
  return tx.categories.counts_toward_summary !== false;
}

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

export async function getMonthlySummary(
  userId: string,
  year: number,
  month: number,
): Promise<MonthlySummary> {
  const transactions = await getTransactions(userId, year, month);

  const byType = {
    income: [] as typeof transactions,
    expense: [] as typeof transactions,
    savings: [] as typeof transactions,
    investment: [] as typeof transactions,
    investmentDeployment: [] as typeof transactions,
  };

  for (const tx of transactions) {
    if (tx.categories.type === "investment" && !countsTowardSummary(tx)) {
      byType.investmentDeployment.push(tx);
      continue;
    }

    byType[tx.categories.type].push(tx);
  }

  const sum = (rows: typeof transactions) =>
    rows.reduce((acc, row) => acc + Number(row.amount), 0);

  const income = sum(byType.income);
  const expenses = sum(byType.expense);
  const savings = sum(byType.savings);
  const investments = sum(byType.investment);
  const investmentDeployments = sum(byType.investmentDeployment);

  return {
    income,
    expenses,
    savings,
    investments,
    investmentDeployments,
    remaining: income - expenses - savings - investments,
    expenseBreakdown: buildBreakdown(byType.expense),
    savingsBreakdown: buildBreakdown(byType.savings),
    investmentBreakdown: buildBreakdown(byType.investment),
    investmentDeploymentBreakdown: buildBreakdown(
      byType.investmentDeployment,
    ),
  };
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

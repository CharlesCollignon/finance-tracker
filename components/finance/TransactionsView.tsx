"use client";

import { useMemo, useState, useTransition } from "react";
import { Plus, Trash } from "@phosphor-icons/react";
import { Button } from "@/components/retroui/Button";
import { Card } from "@/components/retroui/Card";
import { PageHeader } from "@/components/layout/PageHeader";
import { PageContainer } from "@/components/layout/PageContainer";
import { EmptyState } from "@/components/layout/EmptyState";
import { MonthPicker } from "@/components/layout/MonthPicker";
import { SignOutButton } from "@/components/layout/SignOutButton";
import { useToast } from "@/components/layout/ToastProvider";
import { CategoryTypeBadge } from "@/components/finance/CategoryTypeBadge";
import { CategoryIcon } from "@/components/finance/CategoryIcon";
import { Badge } from "@/components/retroui/Badge";
import { TransactionForm } from "@/components/finance/TransactionForm";
import { formatEuro } from "@/lib/constants";
import { yearlyExpenseTemplateIds } from "@/lib/budget";
import { CATEGORY_TYPE_LABELS, TYPE_AMOUNT_CLASS } from "@/lib/category-styles";
import { cn } from "@/lib/utils";
import {
  applyRecurringForMonth,
  deleteTransaction,
  previewApplyRecurringForMonth,
} from "@/lib/actions/finance";
import { ApplyRecurringSheet } from "@/components/finance/ApplyRecurringSheet";
import type { ApplyRecurringPlan } from "@/lib/apply-recurring";
import type {
  Category,
  CategoryType,
  RecurringTemplateWithCategory,
  TransactionWithCategory,
} from "@/lib/types/database";

const TYPE_TOTAL_ITEMS: { type: CategoryType }[] = [
  { type: "income" },
  { type: "expense" },
  { type: "savings" },
  { type: "investment" },
];

function formatSignedTypeTotal(type: CategoryType, amount: number): string {
  const formatted = formatEuro(amount);
  return type === "income" ? `+${formatted}` : `−${formatted}`;
}

type FilterType = "all" | CategoryType;

const FILTER_OPTIONS: { value: FilterType; label: string }[] = [
  { value: "all", label: "All" },
  { value: "income", label: CATEGORY_TYPE_LABELS.income },
  { value: "expense", label: CATEGORY_TYPE_LABELS.expense },
  { value: "savings", label: CATEGORY_TYPE_LABELS.savings },
  { value: "investment", label: CATEGORY_TYPE_LABELS.investment },
];

interface TransactionsViewProps {
  transactions: TransactionWithCategory[];
  categories: Category[];
  recurringTemplates: RecurringTemplateWithCategory[];
  year: number;
  month: number;
  defaultDate: string;
}

function formatDisplayDate(isoDate: string): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

  if (sameDay(date, today)) {
    return "Today";
  }
  if (sameDay(date, yesterday)) {
    return "Yesterday";
  }

  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(date);
}

function groupByDate(
  items: TransactionWithCategory[],
): { date: string; label: string; items: TransactionWithCategory[] }[] {
  const groups = new Map<string, TransactionWithCategory[]>();

  for (const tx of items) {
    const list = groups.get(tx.occurred_on) ?? [];
    list.push(tx);
    groups.set(tx.occurred_on, list);
  }

  return Array.from(groups.entries()).map(([date, groupItems]) => ({
    date,
    label: formatDisplayDate(date),
    items: groupItems,
  }));
}

function countsTowardSummary(tx: TransactionWithCategory): boolean {
  return tx.categories.counts_toward_summary !== false;
}

function computeTypeTotals(transactions: TransactionWithCategory[]) {
  const totals = {
    income: 0,
    expense: 0,
    savings: 0,
    investment: 0,
  };

  for (const tx of transactions) {
    totals[tx.categories.type] += Number(tx.amount);
  }

  return totals;
}

export function TransactionsView({
  transactions,
  categories,
  recurringTemplates,
  year,
  month,
  defaultDate,
}: TransactionsViewProps) {
  const { toast } = useToast();
  const [formOpen, setFormOpen] = useState(false);
  const [filter, setFilter] = useState<FilterType>("all");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [applySheetOpen, setApplySheetOpen] = useState(false);
  const [applyPlan, setApplyPlan] = useState<ApplyRecurringPlan | null>(null);
  const [pending, startTransition] = useTransition();

  const yearlyIds = useMemo(
    () => yearlyExpenseTemplateIds(recurringTemplates),
    [recurringTemplates],
  );

  const typeTotals = useMemo(
    () => computeTypeTotals(transactions),
    [transactions],
  );

  const netTotal = useMemo(
    () =>
      typeTotals.income -
      typeTotals.expense -
      typeTotals.savings -
      typeTotals.investment,
    [typeTotals],
  );

  const filtered = useMemo(() => {
    if (filter === "all") {
      return transactions;
    }
    return transactions.filter((tx) => tx.categories.type === filter);
  }, [transactions, filter]);

  const grouped = useMemo(() => groupByDate(filtered), [filtered]);

  function handleApplyRecurring() {
    startTransition(async () => {
      const result = await previewApplyRecurringForMonth(year, month);
      if (result.error) {
        toast(result.error, "error");
        return;
      }

      const plan = result.plan ?? { toCreate: [], toUpdate: [] };

      if (plan.toCreate.length === 0 && plan.toUpdate.length === 0) {
        toast("All recurring entries already applied", "success");
        return;
      }

      setApplyPlan(plan);
      setApplySheetOpen(true);
    });
  }

  function handleConfirmApply(includeUpdates: boolean) {
    startTransition(async () => {
      const result = await applyRecurringForMonth(year, month, includeUpdates);
      if (result.error) {
        toast(result.error, "error");
        return;
      }

      setApplySheetOpen(false);
      setApplyPlan(null);

      const parts: string[] = [];
      if (result.created) {
        parts.push(`${result.created} added`);
      }
      if (result.updated) {
        parts.push(`${result.updated} updated`);
      }

      toast(
        parts.length > 0
          ? `Recurring applied: ${parts.join(", ")}`
          : "Nothing to apply",
        "success",
      );
    });
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      const result = await deleteTransaction(id);
      setConfirmDeleteId(null);
      if (result.error) {
        toast(result.error, "error");
      } else {
        toast("Transaction deleted", "success");
      }
    });
  }

  return (
    <>
      <PageHeader title="Transactions">
        <MonthPicker basePath="/transactions" />
        <div className="md:hidden">
          <SignOutButton />
        </div>
      </PageHeader>

      <PageContainer className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
            {TYPE_TOTAL_ITEMS.map(({ type }) => (
              <Card key={type} className="p-3 text-center sm:p-4">
                <p className="text-xs text-muted-foreground sm:text-sm">
                  {CATEGORY_TYPE_LABELS[type]}
                </p>
                <p
                  className={cn(
                    "mt-1 tabular-nums text-sm font-semibold sm:text-base",
                    TYPE_AMOUNT_CLASS[type],
                  )}
                >
                  {formatSignedTypeTotal(type, typeTotals[type])}
                </p>
              </Card>
            ))}
          </div>
          <Card
            className={cn(
              "border-2 p-4 text-center sm:p-5",
              netTotal >= 0
                ? "border-[var(--chart-4)] bg-[var(--chart-4)]/10"
                : "border-destructive bg-destructive/10",
            )}
          >
            <p className="font-head text-sm uppercase tracking-wide text-muted-foreground">
              What&apos;s left
            </p>
            <p
              className={cn(
                "mt-1 font-head text-2xl tabular-nums font-semibold sm:text-3xl",
                netTotal >= 0
                  ? "text-[var(--chart-4)]"
                  : "text-destructive",
              )}
            >
              {netTotal >= 0 ? "+" : "−"}
              {formatEuro(Math.abs(netTotal))}
            </p>
          </Card>
        </div>

        <div className="flex flex-col gap-2 md:flex-row md:justify-end">
          <Button
            variant="outline"
            size="lg"
            className="w-full md:w-auto md:min-w-[14rem]"
            onClick={handleApplyRecurring}
            disabled={pending}
          >
            {pending ? "Applying…" : "Apply recurring"}
          </Button>
          <Button
            size="lg"
            className="w-full md:w-auto md:min-w-[14rem]"
            onClick={() => setFormOpen(true)}
          >
            <Plus size={18} className="mr-1" />
            Add transaction
          </Button>
        </div>

        {transactions.length > 0 && (
          <div
            className="flex gap-2 overflow-x-auto pb-1"
            role="tablist"
            aria-label="Filter transactions"
          >
            {FILTER_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                role="tab"
                aria-selected={filter === option.value}
                onClick={() => setFilter(option.value)}
                className={cn(
                  "shrink-0 rounded border-2 px-3 py-1.5 text-sm font-medium",
                  "transition-colors",
                  filter === option.value
                    ? "border-foreground bg-primary text-primary-foreground"
                    : "border-border bg-background hover:bg-accent",
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
        )}

        {transactions.length === 0 ? (
          <EmptyState
            title="No transactions yet"
            description="Add a manual entry or apply your recurring items for this month."
          />
        ) : filtered.length === 0 ? (
          <EmptyState
            title={`No ${CATEGORY_TYPE_LABELS[filter as CategoryType].toLowerCase()} entries`}
            description="Try another filter or add a new transaction."
          >
            <Button size="lg" onClick={() => setFilter("all")}>
              Show all
            </Button>
          </EmptyState>
        ) : (
          <div className="flex flex-col gap-5">
            {grouped.map((group) => (
              <section key={group.date}>
                <h2 className="mb-2 font-head text-sm uppercase tracking-wide text-muted-foreground">
                  {group.label}
                </h2>
                <ul className="flex flex-col gap-2">
                  {group.items.map((tx) => (
                    <li key={tx.id}>
                      <Card className="flex w-full items-center gap-3 p-3 transition-colors hover:bg-accent/30 sm:p-4">
                        <CategoryIcon icon={tx.categories.icon} />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="truncate font-medium">
                              {tx.categories.name}
                            </p>
                            <CategoryTypeBadge type={tx.categories.type} />
                            {!countsTowardSummary(tx) && (
                              <Badge size="sm" variant="outline">
                                Tracking
                              </Badge>
                            )}
                            {tx.recurring_template_id &&
                              yearlyIds.has(tx.recurring_template_id) && (
                                <Badge size="sm" variant="outline">
                                  Annual payment
                                </Badge>
                              )}
                          </div>
                          {tx.note && (
                            <p className="mt-0.5 truncate text-sm text-muted-foreground">
                              {tx.note}
                            </p>
                          )}
                        </div>
                        <span className="shrink-0 tabular-nums text-base font-semibold">
                          {formatEuro(Number(tx.amount))}
                        </span>
                        {confirmDeleteId === tx.id ? (
                          <div className="flex shrink-0 flex-col gap-1">
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-9 min-w-[4.5rem] border-destructive text-destructive"
                              onClick={() => handleDelete(tx.id)}
                              disabled={pending}
                            >
                              Delete
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-9 min-w-[4.5rem]"
                              onClick={() => setConfirmDeleteId(null)}
                            >
                              Cancel
                            </Button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(tx.id)}
                            className={cn(
                              "flex h-10 w-10 shrink-0 items-center justify-center",
                              "rounded border-2 border-border",
                              "hover:bg-destructive hover:text-destructive-foreground",
                            )}
                            aria-label={`Delete ${tx.categories.name}`}
                          >
                            <Trash size={18} />
                          </button>
                        )}
                      </Card>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </PageContainer>

      <TransactionForm
        categories={categories}
        defaultDate={defaultDate}
        open={formOpen}
        onOpenChange={setFormOpen}
      />

      <ApplyRecurringSheet
        open={applySheetOpen}
        onOpenChange={(open) => {
          setApplySheetOpen(open);
          if (!open) {
            setApplyPlan(null);
          }
        }}
        plan={applyPlan}
        pending={pending}
        onConfirm={handleConfirmApply}
      />
    </>
  );
}

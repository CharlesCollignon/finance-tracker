"use client";

import { useMemo, useState, useTransition } from "react";
import { DownloadSimple, MagnifyingGlass, Plus } from "@phosphor-icons/react";
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
import { formatEuro } from "@finance/core/constants";
import { yearlyExpenseTemplateIds } from "@finance/core/budget";
import {
  CATEGORY_TYPE_LABELS,
  TYPE_AMOUNT_CLASS,
} from "@finance/core/category-styles";
import { cn } from "@/lib/utils";
import {
  applyRecurringForMonth,
  previewApplyRecurringForMonth,
} from "@/lib/actions/finance";
import { ApplyRecurringSheet } from "@/components/finance/ApplyRecurringSheet";
import type { ApplyRecurringPlan } from "@finance/core/apply-recurring";
import type {
  Category,
  CategoryType,
  RecurringTemplateWithCategory,
  Tag,
  TransactionWithCategory,
} from "@finance/core/types/database";

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
  tags: Tag[];
  transactionTags: Record<string, Tag[]>;
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

function toCsvValue(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function buildTransactionsCsv(transactions: TransactionWithCategory[]): string {
  const header = ["date", "category", "type", "amount_eur", "note"];
  const rows = transactions.map((tx) =>
    [
      tx.occurred_on,
      toCsvValue(tx.categories.name),
      tx.categories.type,
      String(Number(tx.amount)),
      toCsvValue(tx.note ?? ""),
    ].join(","),
  );

  return [header.join(","), ...rows].join("\n");
}

function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
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
  tags,
  transactionTags,
  year,
  month,
  defaultDate,
}: TransactionsViewProps) {
  const { toast } = useToast();
  const [formOpen, setFormOpen] = useState(false);
  const [editTransaction, setEditTransaction] =
    useState<TransactionWithCategory | null>(null);
  const [filter, setFilter] = useState<FilterType>("all");
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [tagFilter, setTagFilter] = useState<string>("all");
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
    const query = search.trim().toLowerCase();

    return transactions.filter((tx) => {
      if (filter !== "all" && tx.categories.type !== filter) {
        return false;
      }

      if (categoryFilter !== "all" && tx.category_id !== categoryFilter) {
        return false;
      }

      if (tagFilter !== "all") {
        const txTags = transactionTags[tx.id] ?? [];
        if (!txTags.some((tag) => tag.id === tagFilter)) {
          return false;
        }
      }

      if (query.length > 0) {
        const tagNames = (transactionTags[tx.id] ?? [])
          .map((tag) => tag.name)
          .join(" ");
        const haystack =
          `${tx.categories.name} ${tx.note ?? ""} ${tagNames}`.toLowerCase();
        if (!haystack.includes(query)) {
          return false;
        }
      }

      return true;
    });
  }, [
    transactions,
    filter,
    categoryFilter,
    tagFilter,
    search,
    transactionTags,
  ]);

  const hasActiveFilters =
    filter !== "all" ||
    categoryFilter !== "all" ||
    tagFilter !== "all" ||
    search.trim().length > 0;

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

  function handleExport() {
    if (filtered.length === 0) {
      toast("Nothing to export for this view", "error");
      return;
    }

    const monthKey = `${year}-${String(month).padStart(2, "0")}`;
    downloadCsv(`transactions-${monthKey}.csv`, buildTransactionsCsv(filtered));
    toast(`Exported ${filtered.length} transactions`, "success");
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
              "border p-4 text-center sm:p-5",
              netTotal >= 0
                ? "border-success bg-success/10"
                : "border-destructive bg-destructive/10",
            )}
          >
            <p className="font-head text-sm uppercase tracking-wide text-muted-foreground">
              What&apos;s left
            </p>
            <p
              className={cn(
                "privacy-amount mt-1 font-head text-2xl font-semibold sm:text-3xl",
                netTotal >= 0 ? "text-success" : "text-destructive",
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
          <div className="flex flex-col gap-2">
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
                    "shrink-0 rounded border px-3 py-1.5 text-sm font-medium",
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

            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="relative flex-1">
                <MagnifyingGlass
                  size={16}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                  aria-hidden
                />
                <input
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search category or note…"
                  aria-label="Search transactions"
                  className={cn(
                    "h-10 w-full rounded border border-border bg-background",
                    "pl-9 pr-3 text-sm text-foreground",
                  )}
                />
              </div>
              <select
                value={categoryFilter}
                onChange={(event) => setCategoryFilter(event.target.value)}
                aria-label="Filter by category"
                className={cn(
                  "h-10 rounded border border-border bg-background px-3",
                  "text-sm text-foreground sm:w-52",
                )}
              >
                <option value="all">All categories</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
              {tags.length > 0 && (
                <select
                  value={tagFilter}
                  onChange={(event) => setTagFilter(event.target.value)}
                  aria-label="Filter by tag"
                  className={cn(
                    "h-10 rounded border border-border bg-background px-3",
                    "text-sm text-foreground sm:w-40",
                  )}
                >
                  <option value="all">All tags</option>
                  {tags.map((tag) => (
                    <option key={tag.id} value={tag.id}>
                      {tag.name}
                    </option>
                  ))}
                </select>
              )}
              <Button
                variant="outline"
                size="sm"
                className="h-10 px-3"
                onClick={handleExport}
              >
                <DownloadSimple size={16} className="mr-1.5" />
                Export CSV
              </Button>
            </div>
          </div>
        )}

        {transactions.length === 0 ? (
          <EmptyState
            title="No transactions yet"
            description="Add a manual entry or apply your recurring items for this month."
          />
        ) : filtered.length === 0 ? (
          <EmptyState
            title="No matching entries"
            description="Try another search or filter, or add a new transaction."
          >
            {hasActiveFilters && (
              <Button
                size="lg"
                onClick={() => {
                  setFilter("all");
                  setCategoryFilter("all");
                  setTagFilter("all");
                  setSearch("");
                }}
              >
                Clear filters
              </Button>
            )}
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
                      <button
                        type="button"
                        onClick={() => setEditTransaction(tx)}
                        className="w-full text-left"
                        aria-label={`Edit ${tx.categories.name}`}
                      >
                        <Card className="flex w-full items-center gap-3 p-3 transition-colors hover:bg-muted sm:p-4">
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
                              {(transactionTags[tx.id] ?? []).map((tag) => (
                                <Badge key={tag.id} size="sm" variant="outline">
                                  {tag.name}
                                </Badge>
                              ))}
                            </div>
                            {tx.note && (
                              <p className="mt-0.5 truncate text-sm text-muted-foreground">
                                {tx.note}
                              </p>
                            )}
                          </div>
                          <span
                            className={cn(
                              "privacy-amount shrink-0 text-base font-semibold",
                              TYPE_AMOUNT_CLASS[tx.categories.type],
                            )}
                          >
                            {formatEuro(Number(tx.amount))}
                          </span>
                        </Card>
                      </button>
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
        tags={tags}
        defaultDate={defaultDate}
        open={formOpen}
        onOpenChange={setFormOpen}
      />

      <TransactionForm
        categories={categories}
        tags={tags}
        selectedTagIds={
          editTransaction
            ? (transactionTags[editTransaction.id] ?? []).map((t) => t.id)
            : []
        }
        defaultDate={defaultDate}
        open={editTransaction !== null}
        onOpenChange={(open) => {
          if (!open) {
            setEditTransaction(null);
          }
        }}
        transaction={editTransaction}
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

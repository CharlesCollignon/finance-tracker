"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useTransition,
} from "react";
import Link from "next/link";
import {
  DownloadSimple,
  MagnifyingGlass,
  Plus,
  UploadSimple,
} from "@phosphor-icons/react";
import { Button, ButtonNub } from "@/components/retroui/Button";
import { Card } from "@/components/retroui/Card";
import { CategoryIcon } from "@/components/finance/CategoryIcon";
import { PageHeader } from "@/components/layout/PageHeader";
import { PageContainer } from "@/components/layout/PageContainer";
import { EmptyState } from "@/components/layout/EmptyState";
import { MonthPicker } from "@/components/layout/MonthPicker";
import { useToast } from "@/components/layout/ToastProvider";
import { TransactionForm } from "@/components/finance/TransactionForm";
import { StatHero } from "@/components/finance/StatHero";
import { TransactionTypeSankey } from "@/components/finance/lazy-charts";
import { Stagger, StaggerItem } from "@/components/motion/Stagger";
import {
  CATEGORY_TYPE_LABELS,
  TYPE_AMOUNT_CLASS,
} from "@finance/core/category-styles";
import { cn } from "@/lib/utils";
import { useFormatCurrency } from "@/lib/use-currency";
import {
  applyRecurringForMonth,
  previewApplyRecurringForMonth,
} from "@/lib/actions/finance";
import { ApplyRecurringSheet } from "@/components/finance/ApplyRecurringSheet";
import {
  applyRecurringPlanCounts,
  type ApplyRecurringPlan,
} from "@finance/core/apply-recurring";
import type {
  Category,
  CategoryType,
  RecurringTemplateWithCategory,
  Tag,
  TransactionWithCategory,
} from "@finance/core/types/database";

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
  recurringTemplates: _recurringTemplates,
  tags,
  transactionTags,
  year,
  month,
  defaultDate,
}: TransactionsViewProps) {
  const { toast } = useToast();
  const formatEuro = useFormatCurrency();
  const [formOpen, setFormOpen] = useState(false);
  const [editTransaction, setEditTransaction] =
    useState<TransactionWithCategory | null>(null);
  const [filter, setFilter] = useState<FilterType>("all");
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [tagFilter, setTagFilter] = useState<string>("all");
  const [applySheetOpen, setApplySheetOpen] = useState(false);
  const [applyPlan, setApplyPlan] = useState<ApplyRecurringPlan | null>(null);
  const [applyPending, setApplyPending] = useState(false);
  const [pending, startTransition] = useTransition();

  const refreshApplyPending = useCallback(async () => {
    const result = await previewApplyRecurringForMonth(year, month);
    if (result.error || !result.plan) {
      return;
    }
    const counts = applyRecurringPlanCounts(result.plan);
    setApplyPending(counts.creates + counts.updates > 0);
  }, [month, year]);

  useEffect(() => {
    void refreshApplyPending();
  }, [refreshApplyPending, transactions]);

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

  const sortedRows = useMemo(
    () =>
      [...filtered].sort((a, b) => b.occurred_on.localeCompare(a.occurred_on)),
    [filtered],
  );

  const hasActiveFilters =
    filter !== "all" ||
    categoryFilter !== "all" ||
    tagFilter !== "all" ||
    search.trim().length > 0;

  function handleApplyRecurring() {
    startTransition(async () => {
      const result = await previewApplyRecurringForMonth(year, month);
      if (result.error) {
        toast(result.error, "error");
        return;
      }

      const plan = result.plan ?? { toCreate: [], toUpdate: [] };

      if (plan.toCreate.length === 0 && plan.toUpdate.length === 0) {
        setApplyPending(false);
        toast("All recurring entries already applied", "success");
        return;
      }

      setApplyPlan(plan);
      setApplySheetOpen(true);
    });
  }

  function handleConfirmApply(includeUpdates: boolean, selectedKeys: string[]) {
    startTransition(async () => {
      const result = await applyRecurringForMonth(
        year,
        month,
        includeUpdates,
        selectedKeys,
      );
      if (result.error) {
        toast(result.error, "error");
        return;
      }

      setApplySheetOpen(false);
      setApplyPlan(null);
      setApplyPending(false);

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
      void refreshApplyPending();
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
      </PageHeader>

      <PageContainer>
        <Stagger
          className="flex w-full min-w-0 flex-col items-center gap-8 md:gap-10"
          stagger={0.05}
        >
          <StaggerItem className="w-full min-w-0">
            <StatHero
              label="What's left"
              amount={`${netTotal >= 0 ? "+" : "−"}${formatEuro(Math.abs(netTotal))}`}
              amountClassName={
                netTotal >= 0 ? "text-success" : "text-destructive"
              }
              subtitle={
                <p>
                  <span className="privacy-amount text-success tabular-nums">
                    {formatEuro(typeTotals.income)}
                  </span>
                  {" earned · "}
                  <span className="privacy-amount text-destructive tabular-nums">
                    {formatEuro(typeTotals.expense)}
                  </span>
                  {" spent"}
                </p>
              }
            />
          </StaggerItem>

          <StaggerItem className="w-full min-w-0 max-w-2xl">
            <TransactionTypeSankey
              typeTotals={typeTotals}
              remaining={netTotal}
            />
          </StaggerItem>

          <StaggerItem className="flex w-full flex-col items-center gap-3">
            {applyPending ? (
              <p className="text-center text-sm text-muted-foreground">
                Recurring changed — apply to update this month.
              </p>
            ) : null}
            <div className="flex flex-wrap items-center justify-center gap-2">
              <span className="relative inline-flex">
                <Button
                  variant={applyPending ? "default" : "ghost"}
                  size="md"
                  onClick={handleApplyRecurring}
                  disabled={pending}
                >
                  {pending ? "Applying…" : "Apply recurring"}
                </Button>
                {applyPending && !pending ? (
                  <span
                    aria-label="Recurring changes are waiting to be applied"
                    role="status"
                    className="absolute -right-1 -top-1 size-2.5 rounded-full bg-destructive ring-2 ring-background"
                  />
                ) : null}
              </span>
              <Button
                variant="pill"
                size="md"
                onClick={() => setFormOpen(true)}
              >
                Add transaction
                <ButtonNub>
                  <Plus size={16} weight="bold" />
                </ButtonNub>
              </Button>
            </div>
          </StaggerItem>

          {transactions.length > 0 ? (
            <StaggerItem className="w-full space-y-3">
              <div
                className="flex justify-center gap-2 overflow-x-auto pb-1"
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
                      "shrink-0 rounded-full border px-4 py-2 text-sm font-semibold",
                      "transition-colors duration-300",
                      filter === option.value
                        ? "border-foreground bg-foreground text-background"
                        : "border-border text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {option.label}
                  </button>
                ))}
              </div>

              <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
                <div className="relative flex-1 sm:max-w-xs">
                  <MagnifyingGlass
                    size={16}
                    weight="light"
                    className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground"
                    aria-hidden
                  />
                  <input
                    type="search"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search category or note…"
                    aria-label="Search transactions"
                    className={cn(
                      "h-10 w-full rounded-full border border-border bg-card",
                      "pl-10 pr-3 text-sm text-foreground outline-none",
                      "focus:border-foreground",
                    )}
                  />
                </div>
                <select
                  value={categoryFilter}
                  onChange={(event) => setCategoryFilter(event.target.value)}
                  aria-label="Filter by category"
                  className={cn(
                    "h-10 rounded-full border border-border bg-card px-4",
                    "text-sm text-foreground outline-none sm:w-44",
                    "focus:border-foreground",
                  )}
                >
                  <option value="all">All categories</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
                {tags.length > 0 ? (
                  <select
                    value={tagFilter}
                    onChange={(event) => setTagFilter(event.target.value)}
                    aria-label="Filter by tag"
                    className={cn(
                      "h-10 rounded-full border border-border bg-card px-4",
                      "text-sm text-foreground outline-none sm:w-36",
                      "focus:border-foreground",
                    )}
                  >
                    <option value="all">All tags</option>
                    {tags.map((tag) => (
                      <option key={tag.id} value={tag.id}>
                        {tag.name}
                      </option>
                    ))}
                  </select>
                ) : null}
                <Button
                  variant="link"
                  size="sm"
                  className="h-10 px-2"
                  onClick={handleExport}
                >
                  <DownloadSimple size={16} weight="light" className="mr-1.5" />
                  Export CSV
                </Button>
                <Button
                  variant="link"
                  size="sm"
                  className="h-10 px-2"
                  render={
                    <Link href="/import">
                      <UploadSimple
                        size={16}
                        weight="light"
                        className="mr-1.5 inline"
                      />
                      Import CSV
                    </Link>
                  }
                />
              </div>
            </StaggerItem>
          ) : null}

          <StaggerItem className="w-full">
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
                {hasActiveFilters ? (
                  <Button
                    size="md"
                    onClick={() => {
                      setFilter("all");
                      setCategoryFilter("all");
                      setTagFilter("all");
                      setSearch("");
                    }}
                  >
                    Clear filters
                  </Button>
                ) : null}
              </EmptyState>
            ) : (
              <Card.Bezel
                className="w-full"
                innerClassName="divide-y divide-border px-2 py-1"
              >
                {sortedRows.map((tx) => (
                  <button
                    key={tx.id}
                    type="button"
                    onClick={() => setEditTransaction(tx)}
                    aria-label={`Edit ${tx.categories.name}`}
                    className="flex w-full items-center justify-between gap-3 py-3.5 px-2 text-left transition-colors hover:bg-muted/30"
                  >
                    <div className="flex min-w-0 items-center gap-3.5">
                      <CategoryIcon
                        icon={tx.categories.icon}
                        className="h-10 w-10 rounded-[13px] border-0 bg-muted"
                      />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">
                          {tx.categories.name}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {formatDisplayDate(tx.occurred_on)}
                          {tx.note ? ` · ${tx.note}` : ""}
                        </p>
                      </div>
                    </div>
                    <span
                      className={cn(
                        "privacy-amount shrink-0 whitespace-nowrap font-mono text-sm font-medium tabular-nums",
                        TYPE_AMOUNT_CLASS[tx.categories.type],
                      )}
                    >
                      {formatEuro(Number(tx.amount))}
                    </span>
                  </button>
                ))}
              </Card.Bezel>
            )}
          </StaggerItem>
        </Stagger>
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

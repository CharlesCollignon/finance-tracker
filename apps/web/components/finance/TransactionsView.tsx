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
import { CategoryIcon } from "@/components/finance/CategoryIcon";
import type { ReactNode } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { LEDGER_TABS, SurfaceTabs } from "@/components/layout/SurfaceTabs";
import { PageContainer } from "@/components/layout/PageContainer";
import { EmptyState } from "@/components/layout/EmptyState";
import { MonthPicker } from "@/components/layout/MonthPicker";
import { useToast } from "@/components/layout/ToastProvider";
import { TransactionForm } from "@/components/finance/TransactionForm";
import {
  categoryTypeLabels,
  TYPE_AMOUNT_CLASS,
} from "@finance/core/category-styles";
import { cn } from "@/lib/utils";
import { useFormatCurrency } from "@/lib/use-currency";
import {
  formatShortDate,
  relativeDayLabel,
  todayIsoLocal,
} from "@finance/core/constants";
import { buildStillToCome } from "@finance/core/still-to-come";
import {
  applyRecurringForMonth,
  deleteTransactions,
  moveTransactions,
  previewApplyRecurringForMonth,
} from "@/lib/actions/finance";
import { ApplyRecurringSheet } from "@/components/finance/ApplyRecurringSheet";
import { RowCheckbox, SelectionBar } from "@/components/finance/SelectionBar";
import {
  planSelectionMove,
  pruneSelection,
  selectAllState,
  summarizeSelection,
  toggleSelectAll,
  toggleSelected,
} from "@finance/core/selection";
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
import { ICON } from "@/lib/icon-scale";
import { useT } from "@/lib/locale-context";

type FilterType = "all" | CategoryType;

const FILTER_OPTIONS: { value: FilterType; label: string }[] = [
  { value: "all", label: "All" },
  { value: "income", label: categoryTypeLabels().income },
  { value: "expense", label: categoryTypeLabels().expense },
  { value: "savings", label: categoryTypeLabels().savings },
  { value: "investment", label: categoryTypeLabels().investment },
];

interface TransactionsViewProps {
  transactions: TransactionWithCategory[];
  categories: Category[];
  recurringTemplates: RecurringTemplateWithCategory[];
  /** Occurrences waved off for this month, so they are not counted as owed. */
  skippedKeys?: string[];
  tags: Tag[];
  transactionTags: Record<string, Tag[]>;
  year: number;
  month: number;
  defaultDate: string;
  /** Bank feed bar, rendered inside the page rather than above its header. */
  bankSlot?: ReactNode;
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

/**
 * The Ledger's desktop columns: category, note, tags, amount.
 *
 * Above xl a row stops being "name on the left, amount far right with a
 * screen of nothing between them" and becomes four aligned columns. The note
 * and the tags were already on the row — the note under the name, the tags
 * only in the filter — and at this width there is room to show both without
 * pushing the amount around.
 *
 * Shared by the day header so its net lands in the amount column. Kept as one
 * constant because two copies of a grid template is two things to keep in
 * step, and the failure is silent: the columns simply stop lining up.
 *
 * Deliberately not a `<table>`. Each row is a button — clicking it opens the
 * editor, and in select mode it toggles — so the row is the control, and a
 * table row cannot be one without either nesting a button per cell or
 * wrapping a `<tr>` in something that is not allowed to contain it.
 */
const LEDGER_COLUMNS =
  "xl:grid xl:grid-cols-[minmax(0,20rem)_minmax(0,1fr)_minmax(0,12rem)_7rem] xl:items-center xl:gap-4";

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
  skippedKeys,
  tags,
  transactionTags,
  year,
  month,
  defaultDate,
  bankSlot,
}: TransactionsViewProps) {
  const { toast } = useToast();
  const formatEuro = useFormatCurrency();
  const t = useT();
  const [formOpen, setFormOpen] = useState(false);
  const [editTransaction, setEditTransaction] =
    useState<TransactionWithCategory | null>(null);
  const [filter, setFilter] = useState<FilterType>("all");
  const [search, setSearch] = useState("");
  const [selectMode, setSelectMode] = useState(false);
  const [storedSelection, setSelected] = useState<ReadonlySet<string>>(
    new Set(),
  );
  const [deletePending, startDelete] = useTransition();
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

      const plan = result.plan ?? { toCreate: [], toUpdate: [], toReprice: [] };

      if (plan.toCreate.length === 0 && plan.toUpdate.length === 0) {
        setApplyPending(false);
        toast(t("ledger.applyAllDone"), "success");
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
        parts.push(t("ledger.applyAdded", { count: result.created }));
      }
      if (result.updated) {
        parts.push(t("ledger.applyUpdated", { count: result.updated }));
      }

      toast(
        parts.length > 0
          ? t("ledger.applyResult", { parts: parts.join(", ") })
          : t("ledger.applyNothing"),
        "success",
      );
      void refreshApplyPending();
    });
  }

  const visibleIds = useMemo(() => sortedRows.map((tx) => tx.id), [sortedRows]);
  // A filter can hide rows that are still in the stored set. Pruning here
  // rather than in an effect means the hidden ones can never be acted on,
  // without a render pass spent synchronising state to itself.
  const selected = useMemo(
    () => pruneSelection(storedSelection, visibleIds),
    [storedSelection, visibleIds],
  );
  const selectionSummary = useMemo(
    () => summarizeSelection(transactions, selected),
    [transactions, selected],
  );
  const allState = selectAllState(visibleIds, selected);

  function leaveSelectMode() {
    setSelectMode(false);
    setSelected(new Set());
  }

  function handleBulkDelete() {
    startDelete(async () => {
      const result = await deleteTransactions([...selected]);
      if (result.error) {
        toast(result.error, "error");
        return;
      }
      toast(t("ledger.deleted", { count: result.deleted ?? 0 }), "success");
      leaveSelectMode();
    });
  }

  function planMove(categoryId: string) {
    const target = categories.find((category) => category.id === categoryId);
    return target
      ? planSelectionMove(transactions, selected, {
          id: target.id,
          type: target.type,
        })
      : null;
  }

  function handleBulkMove(categoryId: string) {
    startDelete(async () => {
      const result = await moveTransactions([...selected], categoryId);
      if (result.error) {
        toast(result.error, "error");
        return;
      }
      const name =
        categories.find((category) => category.id === categoryId)?.name ??
        "the new category";
      toast(t("ledger.moved", { count: result.moved ?? 0, name }), "success");
      leaveSelectMode();
    });
  }

  function handleExport() {
    if (filtered.length === 0) {
      toast(t("ledger.exportNothing"), "error");
      return;
    }

    const monthKey = `${year}-${String(month).padStart(2, "0")}`;
    downloadCsv(`transactions-${monthKey}.csv`, buildTransactionsCsv(filtered));
    toast(`Exported ${filtered.length} transactions`, "success");
  }

  // A ledger is read a day at a time, not as one unbroken column of two
  // hundred rows. Grouping here rather than in the markup keeps a heading and
  // its rows in the same object, so the list can never draw a date with
  // nothing under it.
  const days = useMemo(() => {
    const out: {
      date: string;
      rows: TransactionWithCategory[];
      net: number;
    }[] = [];

    for (const tx of sortedRows) {
      const amount = Number(tx.amount);
      const signed = tx.categories.type === "income" ? amount : -amount;
      const last = out[out.length - 1];

      if (last && last.date === tx.occurred_on) {
        last.rows.push(tx);
        last.net += signed;
      } else {
        out.push({ date: tx.occurred_on, rows: [tx], net: signed });
      }
    }

    return out;
  }, [sortedRows]);

  // The figures describe what is on screen, which is the whole reason they
  // are here: the month's own totals are Month's job, and repeating them
  // under a filter would state something the list below contradicts.
  const shown = useMemo(() => computeTypeTotals(filtered), [filtered]);
  const shownOut = shown.expense + shown.savings + shown.investment;

  // What the month ends at, which is a fact about the whole month and does
  // not move with the filters beside it — hence its own label rather than a
  // third figure in the In / Out pair.
  const monthEnd = useMemo(() => {
    const all = computeTypeTotals(transactions);
    const upcoming = buildStillToCome(
      transactions,
      recurringTemplates,
      year,
      month,
      todayIsoLocal(),
      new Set(skippedKeys ?? []),
    );
    const inflow = all.income + upcoming.arriving;
    const outflow =
      all.expense + all.savings + all.investment + upcoming.budgetedOutflow;
    return inflow - outflow;
  }, [transactions, recurringTemplates, year, month, skippedKeys]);

  return (
    <>
      <PageHeader titleKey="nav.ledger">
        <MonthPicker basePath="/transactions" />
      </PageHeader>

      <PageContainer className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <SurfaceTabs tabs={LEDGER_TABS} />
          <div className="ml-auto flex shrink-0 items-center gap-2">
            <span className="relative inline-flex">
              <Button
                variant={applyPending ? "default" : "ghost"}
                size="sm"
                onClick={handleApplyRecurring}
                disabled={pending}
              >
                {pending
                  ? t("ledger.applyPending")
                  : t("ledger.applyRecurring")}
              </Button>
              {applyPending && !pending ? (
                <span
                  aria-label={t("ledger.applyWaiting")}
                  role="status"
                  className="absolute -right-1 -top-1 size-2.5 rounded-full bg-destructive ring-2 ring-background"
                />
              ) : null}
            </span>
            <Button variant="pill" size="sm" onClick={() => setFormOpen(true)}>
              Add
              <ButtonNub>
                <Plus size={ICON.md} weight="bold" />
              </ButtonNub>
            </Button>
          </div>
        </div>

        {/* Wrapped rather than dropped in bare: see PageContainer. */}
        {bankSlot ? <div className="contents">{bankSlot}</div> : null}

        {transactions.length === 0 ? (
          <EmptyState
            title={t("ledger.emptyTitle")}
            description={t("ledger.emptyBody")}
          />
        ) : (
          <section className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4 md:p-5">
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-2 sm:flex-row">
                <div className="relative min-w-0 flex-1">
                  <MagnifyingGlass
                    size={ICON.md}
                    weight="light"
                    className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground"
                    aria-hidden
                  />
                  <input
                    type="search"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder={t("ledger.searchPlaceholder")}
                    aria-label={t("ledger.searchLabel")}
                    className={cn(
                      "h-9 w-full rounded-full border border-border bg-background",
                      "pl-9 pr-3 text-sm text-foreground outline-none",
                      "focus:border-foreground",
                    )}
                  />
                </div>
                <div className="flex shrink-0 gap-2">
                  <select
                    value={categoryFilter}
                    onChange={(event) => setCategoryFilter(event.target.value)}
                    aria-label={t("ledger.filterByCategory")}
                    className={cn(
                      "h-9 min-w-0 flex-1 rounded-full border border-border",
                      "bg-background px-3.5 text-sm text-foreground outline-none",
                      "focus:border-foreground sm:w-44 sm:flex-none",
                    )}
                  >
                    <option value="all">{t("ledger.allCategories")}</option>
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
                      aria-label={t("ledger.filterByTag")}
                      className={cn(
                        "h-9 min-w-0 flex-1 rounded-full border border-border",
                        "bg-background px-3.5 text-sm text-foreground outline-none",
                        "focus:border-foreground sm:w-36 sm:flex-none",
                      )}
                    >
                      <option value="all">{t("ledger.allTags")}</option>
                      {tags.map((tag) => (
                        <option key={tag.id} value={tag.id}>
                          {tag.name}
                        </option>
                      ))}
                    </select>
                  ) : null}
                </div>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-x-4">
                <div
                  className="flex min-w-0 flex-1 gap-1.5 overflow-x-auto"
                  role="tablist"
                  aria-label={t("ledger.filterTransactions")}
                >
                  {FILTER_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      role="tab"
                      aria-selected={filter === option.value}
                      onClick={() => setFilter(option.value)}
                      className={cn(
                        "shrink-0 rounded-full border px-3 py-1 text-xs font-medium",
                        "transition-colors duration-200",
                        filter === option.value
                          ? "border-foreground bg-foreground text-background"
                          : "border-border text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>

                <div className="flex shrink-0 items-center justify-end gap-1">
                  <Button
                    variant="link"
                    size="sm"
                    className="h-8 px-2"
                    onClick={() =>
                      selectMode ? leaveSelectMode() : setSelectMode(true)
                    }
                  >
                    {selectMode ? t("ledger.selectDone") : t("ledger.select")}
                  </Button>
                  {selectMode ? (
                    <Button
                      variant="link"
                      size="sm"
                      className="h-8 px-2"
                      onClick={() =>
                        setSelected((current) =>
                          toggleSelectAll(visibleIds, current),
                        )
                      }
                    >
                      {allState === "all"
                        ? t("ledger.clearAll")
                        : t("ledger.selectAll")}
                    </Button>
                  ) : null}
                  <Button
                    variant="link"
                    size="sm"
                    className="h-8 px-2"
                    onClick={handleExport}
                    title={t("ledger.exportCsv")}
                    aria-label={t("ledger.exportCsv")}
                  >
                    <DownloadSimple size={ICON.md} weight="light" />
                  </Button>
                  <Button
                    variant="link"
                    size="sm"
                    className="h-8 px-2"
                    render={
                      <Link
                        href="/import"
                        title={t("ledger.importCsv")}
                        aria-label={t("ledger.importCsv")}
                      >
                        <UploadSimple size={ICON.md} weight="light" />
                      </Link>
                    }
                  />
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-t border-border pt-3 text-sm">
              <p className="text-muted-foreground">
                {filtered.length === transactions.length
                  ? t("ledger.entryCount", { count: transactions.length })
                  : `${filtered.length} of ${transactions.length} entries`}
              </p>
              <p className="flex flex-wrap gap-x-5 gap-y-1">
                <span>
                  <span className="text-muted-foreground">In </span>
                  <span className="privacy-amount tabular-nums text-success">
                    {formatEuro(shown.income)}
                  </span>
                </span>
                <span>
                  <span className="text-muted-foreground">Out </span>
                  <span className="privacy-amount tabular-nums text-destructive">
                    {formatEuro(shownOut)}
                  </span>
                </span>
                <span className="border-l border-border pl-5">
                  <span className="text-muted-foreground">
                    Left at month end{" "}
                  </span>
                  <span
                    className={cn(
                      "privacy-amount tabular-nums",
                      monthEnd < 0 && "text-destructive",
                    )}
                  >
                    {formatEuro(monthEnd)}
                  </span>
                </span>
              </p>
            </div>

            {filtered.length === 0 ? (
              <EmptyState
                title={t("ledger.noMatchTitle")}
                description={t("ledger.noMatchBody")}
                className="border-0 bg-transparent p-6"
              >
                {hasActiveFilters ? (
                  <Button
                    size="sm"
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
              <div className="flex flex-col gap-5">
                {days.map((day) => (
                  <div key={day.date} className="flex flex-col gap-1">
                    <div
                      className={cn(
                        "flex items-baseline justify-between gap-3",
                        LEDGER_COLUMNS,
                      )}
                    >
                      <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        {relativeDayLabel(day.date, formatShortDate)}
                      </h3>
                      <span className="privacy-amount text-xs tabular-nums text-muted-foreground xl:col-start-4 xl:text-right">
                        {day.net >= 0 ? "+" : "−"}
                        {formatEuro(Math.abs(day.net))}
                      </span>
                    </div>

                    <div className="divide-y divide-border">
                      {day.rows.map((tx) => (
                        <button
                          key={tx.id}
                          type="button"
                          onClick={() =>
                            selectMode
                              ? setSelected((current) =>
                                  toggleSelected(current, tx.id),
                                )
                              : setEditTransaction(tx)
                          }
                          aria-label={
                            selectMode
                              ? `Select ${tx.categories.name}`
                              : `Edit ${tx.categories.name}`
                          }
                          aria-pressed={
                            selectMode ? selected.has(tx.id) : undefined
                          }
                          className={cn(
                            "-mx-2 flex w-[calc(100%+1rem)] items-center justify-between gap-3 rounded-lg px-2 py-2.5 text-left",
                            "transition-colors hover:bg-muted/40",
                            LEDGER_COLUMNS,
                            selectMode && selected.has(tx.id) && "bg-primary/5",
                          )}
                        >
                          <span className="flex min-w-0 items-center gap-3">
                            {selectMode ? (
                              <RowCheckbox
                                checked={selected.has(tx.id)}
                                label={`Select ${tx.categories.name}`}
                                onChange={() =>
                                  setSelected((current) =>
                                    toggleSelected(current, tx.id),
                                  )
                                }
                              />
                            ) : null}
                            <CategoryIcon
                              icon={tx.categories.icon}
                              className="size-9 shrink-0 rounded-[12px] border-0 bg-muted"
                            />
                            <span className="min-w-0">
                              <span className="block truncate text-sm font-medium">
                                {tx.categories.name}
                              </span>
                              {/* Under the name until there is a column for
                                  it, so a narrow screen still shows it. */}
                              {tx.note ? (
                                <span className="block truncate text-xs text-muted-foreground xl:hidden">
                                  {tx.note}
                                </span>
                              ) : null}
                            </span>
                          </span>

                          <span className="hidden min-w-0 truncate text-sm text-muted-foreground xl:block">
                            {tx.note}
                          </span>

                          {/* Three at most: past that the column starts
                              deciding the row's width. */}
                          <span className="hidden min-w-0 items-center gap-1 overflow-hidden xl:flex">
                            {(transactionTags[tx.id] ?? [])
                              .slice(0, 3)
                              .map((tag) => (
                                <span
                                  key={tag.id}
                                  className="truncate rounded-full bg-secondary px-2 py-0.5 text-[0.6875rem] text-muted-foreground"
                                >
                                  {tag.name}
                                </span>
                              ))}
                          </span>

                          <span
                            className={cn(
                              "privacy-amount shrink-0 whitespace-nowrap text-sm tabular-nums xl:text-right",
                              TYPE_AMOUNT_CLASS[tx.categories.type],
                            )}
                          >
                            {formatEuro(Number(tx.amount))}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
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

      <SelectionBar
        summary={selectionSummary}
        pending={deletePending}
        onCancel={leaveSelectMode}
        onDelete={handleBulkDelete}
        categories={categories}
        planMove={planMove}
        onMove={handleBulkMove}
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

"use client";

import {
  useCallback,
  useMemo,
  useOptimistic,
  useState,
  useTransition,
} from "react";
import Link from "next/link";
import {
  ArrowRight,
  DownloadSimple,
  MagnifyingGlass,
  Plus,
  SlidersHorizontal,
  UploadSimple,
} from "@phosphor-icons/react";
import { Button, ButtonNub } from "@/components/ui/Button";
import { CategoryIcon } from "@/components/finance/CategoryIcon";
import { FulfilmentDot } from "@/components/finance/FulfilmentDot";
import type { ReactNode } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { LEDGER_TABS, SurfaceTabs } from "@/components/layout/SurfaceTabs";
import { PageContainer } from "@/components/layout/PageContainer";
import { EmptyState } from "@/components/ui/EmptyState";
import { useDeletedToast } from "@/lib/use-deleted-toast";
import { MonthPicker } from "@/components/layout/MonthPicker";
import { useToast } from "@/components/layout/ToastProvider";
import { TransactionForm } from "@/components/finance/TransactionForm";
import { PlannedOccurrenceSheet } from "@/components/finance/PlannedOccurrenceSheet";
import type { PlannedOccurrence } from "@finance/core/apply-recurring";
import { buildLedgerCsv } from "@finance/core/ledger-csv";
import {
  filterLedger,
  filterPlanned,
  ledgerDays,
  ledgerTotals,
  type LedgerTypeFilter,
} from "@finance/core/ledger-view";
import { useQuickAdd } from "@/components/layout/QuickAddProvider";
import { amountSign } from "@finance/core/amount-sign";
import {
  categoryTypeLabels,
  TYPE_AMOUNT_CLASS,
} from "@finance/core/category-styles";
import { cn } from "@/lib/utils";
import { MICRO } from "@/lib/type-scale";
import { useFormatCurrency } from "@/lib/use-currency";
import {
  formatShortDate,
  relativeDayLabel,
  todayIsoLocal,
} from "@finance/core/constants";
import {
  FULFILMENT_DOT_CLASS,
  FULFILMENT_STATE_KEY,
  indexFulfilmentStates,
} from "@finance/core/fulfilment-state";
import { deleteTransactions, moveTransactions } from "@/lib/actions/finance";
import { RowCheckbox, SelectionBar } from "@/components/finance/SelectionBar";
import { CategoryPicker } from "@/components/finance/CategoryPicker";
import {
  planSelectionMove,
  pruneSelection,
  selectAllState,
  summarizeSelection,
  toggleSelectAll,
  toggleSelected,
} from "@finance/core/selection";
import type {
  Category,
  TransactionWithCategory,
} from "@finance/core/types/database";
import { ICON } from "@/lib/icon-scale";
import { useLocale, useT } from "@/lib/locale-context";
import { bringsMoneyIn, isMovedRow } from "@finance/core/cash-date";

type FilterType = LedgerTypeFilter;

interface TransactionsViewProps {
  transactions: TransactionWithCategory[];
  /**
   * The month's charges still to come, drawn from their templates rather than
   * stored. Shown among the rows, and never counted in the figures that
   * describe what has happened.
   */
  planned?: PlannedOccurrence[];
  categories: Category[];
  /** Rows the user has confirmed settle a recurring charge. */
  confirmedTransactionIds?: string[];
  /** Rows the matcher has offered as settling one, awaiting a press. */
  proposedTransactionIds?: string[];
  year: number;
  month: number;
  defaultDate: string;
  /** Bank feed bar, rendered inside the page rather than above its header. */
  bankSlot?: ReactNode;
}

/**
 * Hand the file to the browser. A byte-order mark first, so Excel reads the
 * accents as UTF-8 rather than turning « é » into two odd characters.
 */
function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

/**
 * The Ledger's desktop columns: category, note, amount.
 *
 * Above xl a row stops being "name on the left, amount far right with a
 * screen of nothing between them" and becomes three aligned columns. The
 * note was already on the row, under the name, and at this width there is
 * room to give it a column without pushing the amount around.
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
  "xl:grid xl:grid-cols-[minmax(0,20rem)_minmax(0,1fr)_7rem] xl:items-center xl:gap-4";

/** Nothing deleted yet: the optimistic set's resting state. */
const NONE_DELETED: ReadonlySet<string> = new Set();

export function TransactionsView({
  transactions: loaded,
  planned = [],
  categories,
  confirmedTransactionIds,
  proposedTransactionIds,
  year,
  month,
  defaultDate,
  bankSlot,
}: TransactionsViewProps) {
  const { toast } = useToast();
  const toastDeleted = useDeletedToast();
  // Rows deleted leave at once, not when the server has answered; a failed
  // delete ends the transition and brings them back.
  const [deletedIds, markDeleted] = useOptimistic(
    NONE_DELETED,
    (current, ids: readonly string[]) => new Set([...current, ...ids]),
  );
  const transactions = useMemo(
    () =>
      deletedIds.size === 0
        ? loaded
        : loaded.filter((tx) => !deletedIds.has(tx.id)),
    [loaded, deletedIds],
  );
  const formatEuro = useFormatCurrency();
  const locale = useLocale();
  const t = useT();
  const quickAdd = useQuickAdd();
  // Today while reading this month; the month's first day while reading
  // another, so an entry added from there lands in the month on screen.
  const addDate = todayIsoLocal().startsWith(defaultDate.slice(0, 7))
    ? undefined
    : defaultDate;

  /**
   * The four type filters, plus "all".
   *
   * Built here rather than as a module constant. `categoryTypeLabels()`
   * defaults to the default locale, so a list computed once when the module
   * loaded said "Income / Expense / Savings / Investment" to a French reader
   * whose every other word had been translated — and "All" was never a
   * message at all.
   */
  const filterOptions = useMemo(() => {
    const labels = categoryTypeLabels(locale);
    return [
      { value: "all" as FilterType, label: t("ledger.allTypes") },
      { value: "income" as FilterType, label: labels.income },
      { value: "expense" as FilterType, label: labels.expense },
      { value: "savings" as FilterType, label: labels.savings },
      { value: "investment" as FilterType, label: labels.investment },
    ];
  }, [locale, t]);

  /**
   * What each row can say about itself, by transaction id.
   *
   * Absent from the map is the ordinary case — a movement no template is
   * involved with — and the dot renders nothing for it.
   */
  const fulfilmentStates = useMemo(
    () =>
      indexFulfilmentStates(
        proposedTransactionIds ?? [],
        confirmedTransactionIds ?? [],
      ),
    [proposedTransactionIds, confirmedTransactionIds],
  );
  // The rows here « C'est arrivé ? » asks about. Answered on Le point, whose
  // card asks it, so the Ledger says how many and leads there.
  const toConfirm = transactions.filter(
    (tx) => fulfilmentStates.get(tx.id) === "proposed",
  ).length;

  /**
   * The row's second line: its standing, then whatever the user wrote.
   *
   * The same " · " join the Calendar row already uses, and the state comes
   * first because it is what the dot beside the name is pointing at. The word
   * is not decoration: the amount in this row is already coloured by category
   * type, green for income and red for expense, so a colour on its own does
   * not say which of the row's two schemes it belongs to.
   */
  const rowSubtitle = useCallback(
    (tx: TransactionWithCategory) => {
      const state = fulfilmentStates.get(tx.id);
      return [
        state ? t(FULFILMENT_STATE_KEY[state]) : null,
        // A row counted for another day than its money moved says when that
        // was, since the date beside it is the day it counts for.
        isMovedRow(tx)
          ? t(
              bringsMoneyIn(tx.categories)
                ? "ledger.receivedOn"
                : "ledger.paidOn",
              { date: formatShortDate(tx.cash_on!, locale) },
            )
          : null,
        tx.note,
      ]
        .filter(Boolean)
        .join(" · ");
    },
    [fulfilmentStates, t, locale],
  );
  const [editTransaction, setEditTransaction] =
    useState<TransactionWithCategory | null>(null);
  const [openPlanned, setOpenPlanned] = useState<PlannedOccurrence | null>(
    null,
  );
  const [filter, setFilter] = useState<FilterType>("all");
  const [search, setSearch] = useState("");
  const [selectMode, setSelectMode] = useState(false);
  const [storedSelection, setSelected] = useState<ReadonlySet<string>>(
    new Set(),
  );
  const [deletePending, startDelete] = useTransition();
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  // The phone's filters-and-actions panel. On a wider screen everything in it
  // sits in the toolbar, so the flag only means anything below `md`.
  const [optionsOpen, setOptionsOpen] = useState(false);

  const ledgerFilter = useMemo(
    () => ({ type: filter, categoryId: categoryFilter, query: search }),
    [filter, categoryFilter, search],
  );
  const filtered = useMemo(
    () => filterLedger(transactions, ledgerFilter),
    [transactions, ledgerFilter],
  );
  // The same filters, so a planned rent does not survive an "Income" chip.
  const filteredPlanned = useMemo(
    () => filterPlanned(planned, ledgerFilter),
    [planned, ledgerFilter],
  );

  const sortedRows = useMemo(
    () =>
      [...filtered].sort((a, b) => b.occurred_on.localeCompare(a.occurred_on)),
    [filtered],
  );

  const dropdownFilters = categoryFilter !== "all" ? 1 : 0;
  const hasActiveFilters =
    filter !== "all" || categoryFilter !== "all" || search.trim().length > 0;

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
      const ids = [...selected];
      markDeleted(ids);
      leaveSelectMode();
      const result = await deleteTransactions(ids);
      if (!result.success) {
        toast(result.error, "error");
        return;
      }
      toastDeleted(t("ledger.deleted", { count: result.deleted }), result.undo);
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
        t("ledger.theNewCategory");
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
    downloadCsv(
      `transactions-${monthKey}.csv`,
      buildLedgerCsv(filtered, locale),
    );
    toast(t("ledger.exported", { count: filtered.length }), "success");
  }

  // A ledger is read a day at a time, not as one unbroken column of two
  // hundred rows. Grouping here rather than in the markup keeps a heading and
  // its rows in the same object, so the list can never draw a date with
  // nothing under it.
  // Planned rows join their day but not its net: the net says what the day
  // did, and a planned row has not done anything yet.
  const days = useMemo(
    () => ledgerDays(sortedRows, filteredPlanned),
    [sortedRows, filteredPlanned],
  );

  // The figures describe what is on screen, which is the whole reason they
  // are here: the month's own totals are Month's job, and repeating them
  // under a filter would state something the list below contradicts.
  const shown = useMemo(() => ledgerTotals(filtered), [filtered]);
  const shownOut = shown.expense + shown.savings + shown.investment;

  /**
   * The category dropdown, drawn in the toolbar on a wide screen and full
   * width in the phone's panel. One definition, so the two can never filter
   * differently.
   */
  function renderCategoryFilter(stacked: boolean) {
    // Distinct ids: at phone width both copies are in the document at once,
    // the toolbar's hidden by CSS and the panel's showing.
    const suffix = stacked ? "-panel" : "";
    const triggerClass = "h-9 min-h-11 rounded-full px-3.5 text-sm lg:min-h-0";
    return (
      <CategoryPicker
        id={`ledger-category-filter${suffix}`}
        name="categoryFilter"
        categories={categories}
        value={categoryFilter === "all" ? "" : categoryFilter}
        onValueChange={(categoryId) => setCategoryFilter(categoryId || "all")}
        allLabel={t("ledger.allCategories")}
        label={t("ledger.filterByCategory")}
        className={stacked ? "w-full" : "w-44 flex-none"}
        triggerClassName={triggerClass}
      />
    );
  }

  return (
    <>
      <PageHeader titleKey="nav.ledger" />

      <PageContainer className="flex flex-col gap-3 md:gap-4">
        {/* The views, the month and Add in one row from `lg`: the month in the
            middle, because it is what everything below is about. Narrower,
            the month takes a row of its own under the views — under rather
            than over, so the views stay where they are on the one Ledger view
            that has no month. */}
        <div className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-2 lg:grid-cols-[1fr_auto_1fr]">
          <SurfaceTabs tabs={LEDGER_TABS} className="min-w-0" />
          <MonthPicker
            basePath="/transactions"
            className="col-span-2 row-start-2 justify-self-center lg:col-span-1 lg:col-start-2 lg:row-start-1"
          />
          <div className="flex shrink-0 items-center gap-2 justify-self-end lg:col-start-3 lg:row-start-1">
            {/* A phone has the floating add button; this is the desktop's.
                The same sheet as the notch's "+", opened on the month being
                read when that is not this one. */}
            <Button
              variant="pill"
              size="sm"
              className="hidden md:inline-flex"
              onClick={() => quickAdd?.open({ date: addDate })}
            >
              {t("ledger.add")}
              <ButtonNub>
                <Plus size={ICON.md} weight="bold" />
              </ButtonNub>
            </Button>
          </div>
        </div>

        {/* Wrapped rather than dropped in bare: see PageContainer. */}
        {bankSlot ? <div className="contents">{bankSlot}</div> : null}

        {toConfirm > 0 ? (
          <Link
            href="/bearing"
            className="group -mx-1 flex items-center gap-3 rounded-control px-1 py-1.5 transition-colors hover:bg-muted/40"
          >
            <span
              aria-hidden
              className={cn(
                "size-2 shrink-0 rounded-full",
                FULFILMENT_DOT_CLASS.proposed,
              )}
            />
            <span className="min-w-0 flex-1 truncate text-sm">
              {t("ledger.toConfirm", { count: toConfirm })}
            </span>
            <ArrowRight
              size={ICON.sm}
              aria-hidden
              className="shrink-0 transition-transform group-hover:translate-x-0.5"
            />
          </Link>
        ) : null}

        {transactions.length === 0 && planned.length === 0 ? (
          <EmptyState
            title={t("ledger.emptyTitle")}
            description={t("ledger.emptyBody")}
          />
        ) : (
          // No card on a phone: the list runs the full width and starts
          // right under its toolbar instead of inside another frame.
          <section className="flex flex-col gap-3 md:gap-4 md:rounded-card md:border md:border-border md:bg-card md:p-card">
            <div className="flex flex-col gap-2 md:gap-3">
              <div className="flex items-center gap-2">
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
                      "h-9 min-h-11 lg:min-h-0 w-full rounded-full border border-border bg-background",
                      "pl-9 pr-3 text-sm text-foreground outline-none",
                      "focus:border-foreground",
                    )}
                  />
                </div>

                {/* A phone gets one button for everything that is not the
                    search or the type chips: the two dropdowns, selection,
                    export and import. It used to be three rows of them above
                    the first transaction. */}
                <button
                  type="button"
                  onClick={() => setOptionsOpen((open) => !open)}
                  aria-expanded={optionsOpen}
                  aria-controls="ledger-options"
                  aria-label={t("ledger.optionsToggle")}
                  className={cn(
                    "relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full border md:hidden",
                    "transition-colors duration-hover",
                    optionsOpen || dropdownFilters > 0
                      ? "border-foreground text-foreground"
                      : "border-border text-muted-foreground",
                  )}
                >
                  <SlidersHorizontal size={ICON.md} weight="light" />
                  {dropdownFilters > 0 ? (
                    <span
                      className={cn(
                        "absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-foreground px-1 text-background",
                        MICRO,
                      )}
                    >
                      {dropdownFilters}
                      <span className="sr-only">
                        {t("ledger.filtersOn", { count: dropdownFilters })}
                      </span>
                    </span>
                  ) : null}
                </button>

                <div className="hidden shrink-0 gap-2 md:flex">
                  {renderCategoryFilter(false)}
                </div>
              </div>

              <div className="flex items-center gap-2 sm:gap-x-4">
                {/* A group of toggles, not tabs. `role="tablist"` over
                    `role="tab"` was a promise the markup did not keep: there
                    is no tabpanel for any of these — they filter the list
                    below rather than swapping a panel in — and there was no
                    roving tabindex, so a screen reader announced a tab set
                    whose arrow keys did nothing. `aria-pressed` on plain
                    buttons says which filter is in force and claims no keys
                    the control does not handle. */}
                <div
                  role="group"
                  className="flex min-w-0 flex-1 gap-1.5 overflow-x-auto"
                  aria-label={t("ledger.filterTransactions")}
                >
                  {filterOptions.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      aria-pressed={filter === option.value}
                      onClick={() => setFilter(option.value)}
                      className={cn(
                        "shrink-0 rounded-full border px-3 py-1 text-xs font-medium",
                        "transition-colors duration-hover",
                        filter === option.value
                          ? "border-foreground bg-foreground text-background"
                          : "border-border text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>

                {/* In selection mode a phone keeps Done and Select all here,
                    where the thumb already is; everything else is desktop. */}
                <div
                  className={cn(
                    "shrink-0 items-center justify-end gap-1",
                    selectMode ? "flex" : "hidden md:flex",
                  )}
                >
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
                  <span className="hidden md:contents">
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
                  </span>
                </div>
              </div>

              {optionsOpen ? (
                <div
                  id="ledger-options"
                  className="flex flex-col gap-2 md:hidden"
                >
                  {renderCategoryFilter(true)}
                  <div className="flex flex-wrap gap-2">
                    {selectMode ? null : (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectMode(true);
                          setOptionsOpen(false);
                        }}
                      >
                        {t("ledger.select")}
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleExport}
                      aria-label={t("ledger.exportCsv")}
                    >
                      <DownloadSimple
                        size={ICON.md}
                        weight="light"
                        className="mr-1.5"
                      />
                      {t("ledger.exportShort")}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      render={
                        <Link href="/import" aria-label={t("ledger.importCsv")}>
                          <UploadSimple
                            size={ICON.md}
                            weight="light"
                            className="mr-1.5"
                          />
                          {t("ledger.importShort")}
                        </Link>
                      }
                    />
                  </div>
                </div>
              ) : null}
            </div>

            <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-t border-border pt-3 text-xs md:text-sm">
              {/* On a phone the count only earns its line when a filter is
                  hiding something. */}
              <p
                className={cn(
                  "text-muted-foreground",
                  filtered.length === transactions.length && "hidden md:block",
                )}
              >
                {filtered.length === transactions.length
                  ? t("ledger.entryCount", { count: transactions.length })
                  : t("ledger.shownOfTotal", {
                      count: filtered.length,
                      total: transactions.length,
                    })}
              </p>
              <p className="flex flex-wrap gap-x-4 gap-y-1 md:gap-x-5">
                <span>
                  <span className="text-muted-foreground">
                    {t("ledger.in")}{" "}
                  </span>
                  <span className="privacy-amount tabular-nums text-success">
                    {formatEuro(shown.income)}
                  </span>
                </span>
                <span>
                  <span className="text-muted-foreground">
                    {t("ledger.out")}{" "}
                  </span>
                  <span className="privacy-amount tabular-nums text-destructive">
                    {formatEuro(shownOut)}
                  </span>
                </span>
              </p>
            </div>

            {filtered.length === 0 && filteredPlanned.length === 0 ? (
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
                      setSearch("");
                    }}
                  >
                    {t("ledger.clearFilters")}
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
                        {relativeDayLabel(day.date, formatShortDate, locale)}
                      </h3>
                      {day.rows.length > 0 ? (
                        <span className="privacy-amount text-xs tabular-nums text-muted-foreground xl:col-start-3 xl:text-right">
                          {day.net >= 0 ? "+" : "−"}
                          {formatEuro(Math.abs(day.net))}
                        </span>
                      ) : null}
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
                              ? t("ledger.selectRow", {
                                  name: tx.categories.name,
                                })
                              : t("ledger.editRow", {
                                  name: tx.categories.name,
                                })
                          }
                          aria-pressed={
                            selectMode ? selected.has(tx.id) : undefined
                          }
                          className={cn(
                            "-mx-2 flex w-[calc(100%+1rem)] items-center justify-between gap-3 rounded-control px-2 py-2.5 text-left",
                            "transition-colors hover:bg-muted/40",
                            LEDGER_COLUMNS,
                            // The checkbox says which rows are picked; the
                            // wash only has to group them, which the raised
                            // ground does without the accent.
                            selectMode && selected.has(tx.id) && "bg-muted",
                          )}
                        >
                          <span className="flex min-w-0 items-center gap-3">
                            {selectMode ? (
                              <RowCheckbox
                                checked={selected.has(tx.id)}
                                label={t("ledger.selectRow", {
                                  name: tx.categories.name,
                                })}
                                onChange={() =>
                                  setSelected((current) =>
                                    toggleSelected(current, tx.id),
                                  )
                                }
                              />
                            ) : null}
                            <CategoryIcon
                              icon={tx.categories.icon}
                              className="size-9 shrink-0 rounded-control border-0 bg-muted"
                            />
                            <span className="min-w-0">
                              <span className="flex items-center gap-1.5">
                                {/* `min-w-0` because a flex item defaults to
                                    `min-width: auto`, which defeats `truncate`
                                    and would push the dot out of the row. */}
                                <span className="min-w-0 truncate text-sm font-medium">
                                  {tx.categories.name}
                                </span>
                                <FulfilmentDot
                                  state={fulfilmentStates.get(tx.id)}
                                />
                              </span>
                              {/* Under the name until there is a column for
                                  it, so a narrow screen still shows it. The
                                  state leads, ahead of the note: it is what
                                  the dot beside the name is pointing at, and
                                  the colour alone does not say which of the
                                  row's two colour schemes it belongs to. */}
                              {rowSubtitle(tx) ? (
                                <span className="block truncate text-xs text-muted-foreground xl:hidden">
                                  {rowSubtitle(tx)}
                                </span>
                              ) : null}
                            </span>
                          </span>

                          <span className="hidden min-w-0 truncate text-sm text-muted-foreground xl:block">
                            {rowSubtitle(tx)}
                          </span>

                          {/* The sign is the second channel, and the row had
                              only one. Amounts are stored positive, so
                              `TYPE_AMOUNT_CLASS` alone had to say both what
                              kind of money this is and which way it went —
                              and colour cannot say two things, let alone to
                              a reader who does not separate green from
                              salmon. The day header above has carried `+`/`−`
                              all along; the rows now agree with it. */}
                          <span
                            className={cn(
                              "privacy-amount shrink-0 whitespace-nowrap text-sm tabular-nums xl:text-right",
                              TYPE_AMOUNT_CLASS[tx.categories.type],
                            )}
                          >
                            {amountSign(tx.categories.type)}
                            {formatEuro(Number(tx.amount))}
                          </span>
                        </button>
                      ))}
                      {day.planned.map((occurrence) => (
                        <PlannedRow
                          key={occurrence.key}
                          occurrence={occurrence}
                          disabled={selectMode}
                          onOpen={() => setOpenPlanned(occurrence)}
                        />
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
        open={editTransaction !== null}
        onOpenChange={(open) => {
          if (!open) {
            setEditTransaction(null);
          }
        }}
        transaction={editTransaction}
        onDeleting={(id) => markDeleted([id])}
      />

      <PlannedOccurrenceSheet
        occurrence={openPlanned}
        onOpenChange={(open) => {
          if (!open) {
            setOpenPlanned(null);
          }
        }}
        inCurrentMonth={todayIsoLocal().startsWith(defaultDate.slice(0, 7))}
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
    </>
  );
}

/**
 * A charge's occurrence still to come, among the rows that have happened.
 *
 * Told apart three ways, because dimming alone says nothing to a reader who
 * cannot see it and little to one who can: the icon sits in a dashed outline
 * instead of a filled square, the name and amount are muted, and the second
 * line starts with the word. Pressing it opens what can be done about it;
 * in select mode it is inert, since there is nothing stored to select.
 */
function PlannedRow({
  occurrence,
  disabled,
  onOpen,
}: {
  occurrence: PlannedOccurrence;
  disabled: boolean;
  onOpen: () => void;
}) {
  const t = useT();
  const formatEuro = useFormatCurrency();
  // One whose day has come is not coming up: the bank has not brought it.
  const word = t(occurrence.awaited ? "ledger.awaited" : "ledger.planned");
  const subtitle = [word, occurrence.note].filter(Boolean).join(" · ");

  return (
    <button
      type="button"
      onClick={onOpen}
      disabled={disabled}
      aria-label={`${occurrence.name}, ${word}`}
      className={cn(
        "-mx-2 flex w-[calc(100%+1rem)] items-center justify-between gap-3 rounded-control px-2 py-2.5 text-left",
        "transition-colors hover:bg-muted/40 disabled:cursor-default disabled:hover:bg-transparent",
        LEDGER_COLUMNS,
      )}
    >
      <span className="flex min-w-0 items-center gap-3">
        <CategoryIcon
          icon={occurrence.categoryIcon}
          className="size-9 shrink-0 rounded-control border border-dashed border-hairline-strong bg-transparent opacity-70"
        />
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium text-muted-foreground">
            {occurrence.categoryName}
          </span>
          <span className="block truncate text-xs text-muted-foreground xl:hidden">
            {subtitle}
          </span>
        </span>
      </span>

      <span className="hidden min-w-0 truncate text-sm text-muted-foreground xl:block">
        {subtitle}
      </span>

      <span className="privacy-amount shrink-0 whitespace-nowrap text-sm tabular-nums text-muted-foreground xl:text-right">
        {amountSign(occurrence.categoryType)}
        {formatEuro(occurrence.amount)}
      </span>
    </button>
  );
}

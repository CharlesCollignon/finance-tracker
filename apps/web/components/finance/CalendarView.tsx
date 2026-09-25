"use client";

import { useMemo, useState, useTransition } from "react";
import { Plus } from "@phosphor-icons/react";
import { Button, ButtonNub } from "@/components/retroui/Button";
import { Card } from "@/components/retroui/Card";
import { PageHeader } from "@/components/layout/PageHeader";
import { LEDGER_TABS, SurfaceTabs } from "@/components/layout/SurfaceTabs";
import { PageContainer } from "@/components/layout/PageContainer";
import { EmptyState } from "@/components/layout/EmptyState";
import { MonthPicker } from "@/components/layout/MonthPicker";
import { TransactionForm } from "@/components/finance/TransactionForm";
import { RowCheckbox, SelectionBar } from "@/components/finance/SelectionBar";
import { useToast } from "@/components/layout/ToastProvider";
import { FulfilmentDot } from "@/components/finance/FulfilmentDot";
import { deleteTransactions, moveTransactions } from "@/lib/actions/finance";
import {
  planSelectionMove,
  selectAllState,
  summarizeSelection,
  toggleSelectAll,
  toggleSelected,
} from "@finance/core/selection";
import { StatHero } from "@/components/finance/StatHero";
import { Stagger, StaggerItem } from "@/components/motion/Stagger";
import { formatMonthLabel } from "@finance/core/constants";
import { TYPE_AMOUNT_CLASS } from "@finance/core/category-styles";
import { amountSign } from "@/components/finance/amount-sign";
import {
  FULFILMENT_STATE_KEY,
  indexFulfilmentStates,
} from "@finance/core/fulfilment-state";
import { computeMonthlyBudget } from "@finance/core/budget";
import {
  buildCalendarWeeks,
  computeDayTotals,
  defaultSelectedDate,
  formatCalendarDate,
  formatShortAmount,
  groupTransactionsByDate,
  weekdayLabels,
} from "@finance/core/calendar";
import { cn } from "@/lib/utils";
import { useFormatCurrency } from "@/lib/use-currency";
import type {
  Category,
  RecurringTemplateWithCategory,
  Tag,
  TransactionWithCategory,
} from "@finance/core/types/database";
import { ICON } from "@/lib/icon-scale";
import { useLocale, useT } from "@/lib/locale-context";

/** Stable identity, so the derived selection does not change every render. */
const EMPTY_SELECTION: ReadonlySet<string> = new Set();

interface CalendarViewProps {
  transactions: TransactionWithCategory[];
  categories: Category[];
  recurringTemplates: RecurringTemplateWithCategory[];
  /** Rows the user has confirmed settle a recurring charge. */
  confirmedTransactionIds?: string[];
  /** Rows the matcher has offered as settling one, awaiting a press. */
  proposedTransactionIds?: string[];
  tags: Tag[];
  /** Each transaction's tags, by transaction id, for this month. */
  transactionTags: Record<string, Tag[]>;
  year: number;
  month: number;
}

export function CalendarView({
  transactions,
  categories,
  recurringTemplates,
  confirmedTransactionIds,
  proposedTransactionIds,
  tags,
  transactionTags,
  year,
  month,
}: CalendarViewProps) {
  const t = useT();
  const formatEuro = useFormatCurrency();
  const locale = useLocale();
  const { toast } = useToast();

  /** What each row can say about itself, by transaction id. */
  const fulfilmentStates = useMemo(
    () =>
      indexFulfilmentStates(
        proposedTransactionIds ?? [],
        confirmedTransactionIds ?? [],
      ),
    [proposedTransactionIds, confirmedTransactionIds],
  );
  // Row selection is keyed by day, the same way the day itself is keyed by
  // month above: changing day empties it by derivation, with no effect.
  const [rowSelection, setRowSelection] = useState<{
    date: string;
    mode: boolean;
    ids: ReadonlySet<string>;
  }>({ date: "", mode: false, ids: EMPTY_SELECTION });
  const [deletePending, startDelete] = useTransition();
  const [editTransaction, setEditTransaction] =
    useState<TransactionWithCategory | null>(null);
  const byDate = useMemo(
    () => groupTransactionsByDate(transactions),
    [transactions],
  );
  const weeks = useMemo(() => buildCalendarWeeks(year, month), [year, month]);
  const monthTotals = useMemo(
    () => computeMonthlyBudget(transactions, recurringTemplates),
    [transactions, recurringTemplates],
  );

  // Selection is keyed by month so navigating months resets to the
  // default day without needing a state-syncing effect.
  const monthKey = `${year}-${month}`;
  const [selection, setSelection] = useState<{
    monthKey: string;
    date: string;
  } | null>(null);
  const [formOpen, setFormOpen] = useState(false);

  const selectedDate =
    selection && selection.monthKey === monthKey
      ? selection.date
      : defaultSelectedDate(year, month, byDate);

  function setSelectedDate(date: string) {
    setSelection({ monthKey, date });
  }

  const selectedTransactions = byDate.get(selectedDate) ?? [];
  const visibleIds = selectedTransactions.map((tx) => tx.id);
  const onThisDay = rowSelection.date === selectedDate;
  const selected = onThisDay ? rowSelection.ids : EMPTY_SELECTION;
  const selectMode = onThisDay && rowSelection.mode;
  const selectionSummary = summarizeSelection(selectedTransactions, selected);
  const allState = selectAllState(visibleIds, selected);

  function setSelected(next: (current: ReadonlySet<string>) => Set<string>) {
    setRowSelection((current) => {
      const base =
        current.date === selectedDate ? current.ids : EMPTY_SELECTION;
      return { date: selectedDate, mode: true, ids: next(base) };
    });
  }

  function setSelectMode(mode: boolean) {
    setRowSelection({ date: selectedDate, mode, ids: EMPTY_SELECTION });
  }

  function leaveSelectMode() {
    setRowSelection({ date: selectedDate, mode: false, ids: EMPTY_SELECTION });
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
        t("ledger.theNewCategory");
      toast(t("ledger.moved", { count: result.moved ?? 0, name }), "success");
      leaveSelectMode();
    });
  }
  const selectedTotals = computeDayTotals(selectedTransactions);
  const monthLabel = formatMonthLabel(year, month);

  return (
    <>
      <PageHeader titleKey="nav.ledger">
        <MonthPicker basePath="/calendar" />
      </PageHeader>

      <PageContainer>
        <SurfaceTabs tabs={LEDGER_TABS} className="mb-4" />
        <Stagger
          className="flex w-full min-w-0 flex-col items-center gap-8 md:gap-10"
          stagger={0.05}
        >
          <StaggerItem className="w-full min-w-0">
            <Card.Bezel className="w-full" innerClassName="p-6 md:p-8">
              <StatHero
                label={monthLabel}
                amount={`${monthTotals.net >= 0 ? "+" : "−"}${formatEuro(Math.abs(monthTotals.net))}`}
                amountClassName={
                  monthTotals.net < 0 ? "text-destructive" : "text-success"
                }
                subtitle={
                  // One message rather than two figures with English glue
                  // between them: where "in" and "out" fall in the sentence
                  // is the language's decision, not the layout's. The whole
                  // line is money, so the whole line carries the marker.
                  <p className="privacy-sensitive font-mono tabular-nums">
                    {t("calendarView.inAndOut", {
                      income: formatEuro(monthTotals.income),
                      outflow: formatEuro(monthTotals.outflow),
                    })}
                  </p>
                }
              />
            </Card.Bezel>
          </StaggerItem>

          <StaggerItem className="w-full min-w-0">
            {/* Full-bleed on mobile so the 7-day grid uses the screen width. */}
            <section
              className="-mx-4 w-[calc(100%+2rem)] min-w-0 sm:mx-0 sm:w-full"
              aria-label={t("calendarView.monthlyCalendar")}
            >
              <div className="grid w-full grid-cols-7 border-b border-border/40">
                {weekdayLabels(locale).map((label) => (
                  <div
                    key={label}
                    className={cn(
                      "py-2.5 text-center text-[11px] font-medium uppercase",
                      "tracking-wide text-muted-foreground sm:text-xs",
                    )}
                  >
                    <span className="sm:hidden">{label.charAt(0)}</span>
                    <span className="hidden sm:inline">{label}</span>
                  </div>
                ))}
              </div>

              <div className="flex w-full flex-col">
                {weeks.map((week, weekIndex) => (
                  <div
                    key={weekIndex}
                    className="grid w-full grid-cols-7 border-b border-border/40 last:border-b-0"
                  >
                    {week.map((day) => {
                      const dayTxs = byDate.get(day.date) ?? [];
                      const totals = computeDayTotals(dayTxs);
                      const isSelected = day.date === selectedDate;

                      return (
                        <button
                          key={day.date}
                          type="button"
                          onClick={() => setSelectedDate(day.date)}
                          className={cn(
                            "flex min-h-[4.25rem] min-w-0 flex-col items-stretch",
                            "border-r border-border/40 p-1.5 text-left",
                            "transition-colors last:border-r-0",
                            "sm:min-h-[4.75rem] sm:p-2 md:min-h-[5.5rem]",
                            // A day spilling in from the neighbouring month is
                            // pressable like any other, so its number has to
                            // be readable. It was `text-muted-foreground/50`,
                            // about 2.6:1 on the grid ground. Full-strength
                            // muted foreground against the foreground the
                            // month's own days carry is the distinction, and
                            // the missing hover wash says the rest.
                            !day.isCurrentMonth && "text-muted-foreground",
                            // Today is an inset hairline and the day you are
                            // reading is a raised ground, so the two can be
                            // true at once and neither spends the accent on a
                            // grid that repeats it forty-two times.
                            day.isToday &&
                              "ring-1 ring-inset ring-hairline-strong",
                            isSelected && "bg-muted",
                            day.isCurrentMonth &&
                              !isSelected &&
                              "hover:bg-muted/30",
                          )}
                          aria-label={t("calendarView.dayLabel", {
                            day: day.day,
                            entries:
                              totals.count > 0
                                ? t("ledger.entryCount", {
                                    count: totals.count,
                                  })
                                : t("calendarView.noTransactions"),
                          })}
                          aria-pressed={isSelected}
                        >
                          {/* Today's numeral needs no colour of its own: the
                              cell it sits in is the one carrying the inset
                              hairline, and every day of this month is already
                              set in the foreground. */}
                          <span className="text-sm font-semibold leading-none">
                            {day.day}
                          </span>

                          {totals.income > 0 ? (
                            <span
                              className={cn(
                                "privacy-amount mt-auto truncate font-mono",
                                "text-[10px] font-medium leading-tight text-success",
                                "md:text-xs",
                              )}
                            >
                              +{formatShortAmount(totals.income, locale)} €
                            </span>
                          ) : null}
                          {totals.outflow > 0 ? (
                            <span
                              className={cn(
                                "privacy-amount truncate font-mono text-[10px]",
                                "font-medium leading-tight text-destructive md:text-xs",
                                totals.income > 0 && "-mt-0.5",
                              )}
                            >
                              −{formatShortAmount(totals.outflow, locale)} €
                            </span>
                          ) : null}
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>
            </section>
          </StaggerItem>

          <StaggerItem className="w-full min-w-0">
            <section
              className="flex min-w-0 flex-col gap-3"
              aria-label={t("calendarView.selectedDay")}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-sm font-medium text-muted-foreground">
                    {formatCalendarDate(selectedDate)}
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {selectedTotals.count === 0
                      ? t("calendarView.noTransactions")
                      : t("ledger.entryCount", { count: selectedTotals.count })}
                    {selectedTotals.count > 0 ? (
                      <span className="privacy-sensitive font-mono">
                        {" · "}
                        {t("calendarView.inAndOut", {
                          income: formatEuro(selectedTotals.income),
                          outflow: formatEuro(selectedTotals.outflow),
                        })}
                      </span>
                    ) : (
                      ""
                    )}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  {selectedTransactions.length > 0 ? (
                    <Button
                      variant="link"
                      size="sm"
                      onClick={() =>
                        selectMode ? leaveSelectMode() : setSelectMode(true)
                      }
                    >
                      {selectMode ? t("ledger.selectDone") : t("ledger.select")}
                    </Button>
                  ) : null}
                  {selectMode ? (
                    <Button
                      variant="link"
                      size="sm"
                      onClick={() =>
                        setSelected((current) =>
                          toggleSelectAll(visibleIds, current),
                        )
                      }
                    >
                      {allState === "all"
                        ? t("ledger.clearAll")
                        : t("calendarView.all")}
                    </Button>
                  ) : null}
                  <Button size="sm" onClick={() => setFormOpen(true)}>
                    <Plus size={ICON.md} weight="bold" />
                    <span className="hidden sm:inline">{t("ledger.add")}</span>
                  </Button>
                </div>
              </div>

              {selectedTransactions.length === 0 ? (
                <EmptyState
                  title={t("calendarView.emptyTitle")}
                  description={t("calendarView.emptyBody")}
                >
                  <Button
                    variant="pill"
                    size="md"
                    onClick={() => setFormOpen(true)}
                  >
                    {t("ledger.addTransaction")}
                    <ButtonNub>
                      <Plus size={ICON.md} weight="bold" />
                    </ButtonNub>
                  </Button>
                </EmptyState>
              ) : (
                <Card.Bezel
                  className="w-full"
                  innerClassName="divide-y divide-border px-2 py-1"
                >
                  {selectedTransactions.map((tx) => {
                    const fulfilment = fulfilmentStates.get(tx.id);
                    return (
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
                        aria-label={t(
                          selectMode ? "ledger.selectRow" : "ledger.editRow",
                          { name: tx.categories.name },
                        )}
                        aria-pressed={
                          selectMode ? selected.has(tx.id) : undefined
                        }
                        className={cn(
                          "flex w-full items-start gap-3 px-2 py-3.5 text-left transition-colors hover:bg-muted/30",
                          // The checkbox is what says a row is picked; the
                          // wash behind it only has to separate the picked
                          // rows from the rest, which the raised ground does.
                          selectMode && selected.has(tx.id) && "bg-muted",
                        )}
                      >
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
                        <div className="min-w-0 flex-1">
                          {/* `items-baseline`, not `items-center`: this name is
                            allowed to wrap to two lines, and a centred dot
                            would then float in the middle of the block
                            instead of sitting beside the first word. */}
                          <p className="flex items-baseline gap-1.5 text-sm font-medium leading-snug">
                            <span className="min-w-0">
                              {tx.categories.name}
                            </span>
                            <FulfilmentDot state={fulfilment} />
                          </p>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {[
                              // Ahead of "recurring": this is the newer and more
                              // specific fact about the row, and it is the one
                              // the dot beside the name is pointing at.
                              fulfilment
                                ? t(FULFILMENT_STATE_KEY[fulfilment])
                                : null,
                              tx.recurring_template_id
                                ? t("calendarView.recurring")
                                : null,
                              tx.note,
                            ]
                              .filter(Boolean)
                              .join(" · ") || "—"}
                          </p>
                        </div>
                        <span
                          className={cn(
                            "privacy-amount shrink-0 font-mono text-sm font-semibold tabular-nums",
                            TYPE_AMOUNT_CLASS[tx.categories.type],
                          )}
                        >
                          {amountSign(tx.categories.type)}
                          {formatEuro(Number(tx.amount))}
                        </span>
                      </button>
                    );
                  })}
                </Card.Bezel>
              )}
            </section>
          </StaggerItem>
        </Stagger>
      </PageContainer>

      <SelectionBar
        summary={selectionSummary}
        pending={deletePending}
        onCancel={leaveSelectMode}
        onDelete={handleBulkDelete}
        categories={categories}
        planMove={planMove}
        onMove={handleBulkMove}
      />

      <TransactionForm
        categories={categories}
        tags={tags}
        defaultDate={selectedDate}
        open={formOpen}
        onOpenChange={setFormOpen}
      />

      <TransactionForm
        categories={categories}
        tags={tags}
        selectedTagIds={
          editTransaction
            ? (transactionTags[editTransaction.id] ?? []).map((tag) => tag.id)
            : []
        }
        defaultDate={selectedDate}
        open={editTransaction !== null}
        onOpenChange={(open) => {
          if (!open) {
            setEditTransaction(null);
          }
        }}
        transaction={editTransaction}
      />
    </>
  );
}

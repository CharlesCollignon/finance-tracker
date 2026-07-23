"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus } from "@phosphor-icons/react";
import { Button } from "@/components/retroui/Button";
import { Card } from "@/components/retroui/Card";
import { PageHeader } from "@/components/layout/PageHeader";
import { PageContainer } from "@/components/layout/PageContainer";
import { EmptyState } from "@/components/layout/EmptyState";
import { MonthPicker } from "@/components/layout/MonthPicker";
import { SignOutButton } from "@/components/layout/SignOutButton";
import { CategoryTypeBadge } from "@/components/finance/CategoryTypeBadge";
import { CategoryIcon } from "@/components/finance/CategoryIcon";
import { TransactionForm } from "@/components/finance/TransactionForm";
import { formatEuro } from "@finance/core/constants";
import { computeMonthlyBudget } from "@finance/core/budget";
import {
  buildCalendarWeeks,
  computeDayTotals,
  defaultSelectedDate,
  formatCalendarDate,
  formatShortAmount,
  groupTransactionsByDate,
  WEEKDAY_LABELS,
} from "@finance/core/calendar";
import { cn } from "@/lib/utils";
import type {
  Category,
  RecurringTemplateWithCategory,
  TransactionWithCategory,
} from "@finance/core/types/database";

interface CalendarViewProps {
  transactions: TransactionWithCategory[];
  categories: Category[];
  recurringTemplates: RecurringTemplateWithCategory[];
  year: number;
  month: number;
}

export function CalendarView({
  transactions,
  categories,
  recurringTemplates,
  year,
  month,
}: CalendarViewProps) {
  const byDate = useMemo(
    () => groupTransactionsByDate(transactions),
    [transactions],
  );
  const weeks = useMemo(() => buildCalendarWeeks(year, month), [year, month]);
  const monthTotals = useMemo(
    () => computeMonthlyBudget(transactions, recurringTemplates),
    [transactions, recurringTemplates],
  );

  const [selectedDate, setSelectedDate] = useState(() =>
    defaultSelectedDate(year, month, byDate),
  );
  const [formOpen, setFormOpen] = useState(false);

  useEffect(() => {
    setSelectedDate(defaultSelectedDate(year, month, byDate));
  }, [year, month, byDate]);

  const selectedTransactions = byDate.get(selectedDate) ?? [];
  const selectedTotals = computeDayTotals(selectedTransactions);

  return (
    <>
      <PageHeader title="Calendar">
        <MonthPicker basePath="/calendar" />
        <div className="md:hidden">
          <SignOutButton />
        </div>
      </PageHeader>

      <PageContainer className="flex flex-1 flex-col gap-3 min-h-0">
        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          <SummaryTile label="In" amount={monthTotals.income} tone="income" />
          <SummaryTile label="Out" amount={monthTotals.outflow} tone="outflow" />
          <SummaryTile
            label="Net"
            amount={monthTotals.net}
            tone={monthTotals.net < 0 ? "negative" : "neutral"}
          />
        </div>

        <section
          className={cn(
            "flex flex-1 flex-col overflow-hidden rounded border-2",
            "border-border bg-card",
          )}
          aria-label="Monthly calendar"
        >
          <div className="grid grid-cols-7 border-b-2 border-border">
            {WEEKDAY_LABELS.map((label) => (
              <div
                key={label}
                className={cn(
                  "py-2 text-center text-[10px] font-medium uppercase",
                  "tracking-wide text-muted-foreground sm:text-xs",
                )}
              >
                <span className="sm:hidden">{label.charAt(0)}</span>
                <span className="hidden sm:inline">{label}</span>
              </div>
            ))}
          </div>

          <div className="grid min-h-[14rem] flex-1 auto-rows-fr sm:min-h-[18rem]">
            {weeks.map((week, weekIndex) => (
              <div
                key={weekIndex}
                className="grid grid-cols-7 border-b-2 border-border last:border-b-0"
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
                        "flex min-h-[3.25rem] flex-col items-stretch",
                        "border-r-2 border-border p-1 text-left",
                        "transition-colors last:border-r-0",
                        "sm:min-h-[4.5rem] sm:p-1.5 md:min-h-[5.5rem]",
                        day.isCurrentMonth
                          ? "bg-card hover:bg-accent/40"
                          : "bg-muted/20 text-muted-foreground/60",
                        day.isToday && "bg-accent/30",
                        isSelected &&
                          "ring-2 ring-inset ring-primary bg-primary/10",
                      )}
                      aria-label={`${day.day}${
                        totals.count > 0
                          ? `, ${totals.count} transactions`
                          : ", no transactions"
                      }`}
                      aria-pressed={isSelected}
                    >
                      <span
                        className={cn(
                          "text-xs font-semibold sm:text-sm",
                          day.isToday && "text-primary",
                        )}
                      >
                        {day.day}
                      </span>

                      {totals.income > 0 && (
                        <span
                          className={cn(
                            "mt-auto truncate text-[9px] font-medium",
                            "leading-tight text-[var(--chart-1)]",
                            "sm:text-[10px] md:text-xs",
                          )}
                        >
                          +{formatShortAmount(totals.income)}€
                        </span>
                      )}
                      {totals.outflow > 0 && (
                        <span
                          className={cn(
                            "truncate text-[9px] font-medium leading-tight",
                            "text-destructive sm:text-[10px] md:text-xs",
                            totals.income > 0 && "-mt-0.5",
                          )}
                        >
                          −{formatShortAmount(totals.outflow)}€
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </section>

        <section
          className="flex flex-col gap-3"
          aria-label="Selected day details"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="font-head text-base sm:text-lg">
                {formatCalendarDate(selectedDate)}
              </h2>
              <p className="mt-0.5 text-xs text-muted-foreground sm:text-sm">
                {selectedTotals.count === 0
                  ? "No transactions"
                  : `${selectedTotals.count} transaction${
                      selectedTotals.count === 1 ? "" : "s"
                    }`}
              </p>
            </div>
            <Button
              size="sm"
              className="shrink-0"
              onClick={() => setFormOpen(true)}
            >
              <Plus size={16} weight="bold" />
              <span className="hidden sm:inline">Add</span>
            </Button>
          </div>

          {selectedTotals.count > 0 && (
            <div className="grid grid-cols-3 gap-2">
              <SummaryTile
                label="In"
                amount={selectedTotals.income}
                tone="income"
                compact
              />
              <SummaryTile
                label="Out"
                amount={selectedTotals.outflow}
                tone="outflow"
                compact
              />
              <SummaryTile
                label="Net"
                amount={selectedTotals.net}
                tone={selectedTotals.net < 0 ? "negative" : "neutral"}
                compact
              />
            </div>
          )}

          {selectedTransactions.length === 0 ? (
            <EmptyState
              title="Nothing on this day"
              description="Add a transaction or pick another date."
            >
              <Button size="lg" onClick={() => setFormOpen(true)}>
                Add transaction
              </Button>
            </EmptyState>
          ) : (
            <ul className="flex flex-col gap-2">
              {selectedTransactions.map((tx) => (
                <li key={tx.id}>
                  <Card
                    className={cn(
                      "flex w-full items-center gap-3 p-3 sm:p-4",
                    )}
                  >
                    <CategoryIcon icon={tx.categories.icon} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium leading-snug break-words">
                          {tx.categories.name}
                        </p>
                        <CategoryTypeBadge type={tx.categories.type} />
                      </div>
                      {tx.note && (
                        <p className="mt-0.5 text-sm text-muted-foreground break-words">
                          {tx.note}
                        </p>
                      )}
                    </div>
                    <span
                      className={cn(
                        "shrink-0 tabular-nums text-base font-semibold",
                        tx.categories.type === "income" &&
                          "text-[var(--chart-1)]",
                      )}
                    >
                      {tx.categories.type === "income" ? "+" : "−"}
                      {formatEuro(Number(tx.amount))}
                    </span>
                  </Card>
                </li>
              ))}
            </ul>
          )}
        </section>
      </PageContainer>

      <TransactionForm
        categories={categories}
        defaultDate={selectedDate}
        open={formOpen}
        onOpenChange={setFormOpen}
      />
    </>
  );
}

interface SummaryTileProps {
  label: string;
  amount: number;
  tone: "income" | "outflow" | "negative" | "neutral";
  compact?: boolean;
}

function SummaryTile({ label, amount, tone, compact }: SummaryTileProps) {
  return (
    <Card
      className={cn(
        "p-2 text-center sm:p-3",
        tone === "negative" && "border-destructive",
      )}
    >
      <p className="text-[10px] text-muted-foreground sm:text-xs">{label}</p>
      <p
        className={cn(
          "mt-0.5 tabular-nums font-semibold",
          compact ? "text-sm sm:text-base" : "text-sm sm:text-lg",
          tone === "income" && "text-[var(--chart-1)]",
          tone === "outflow" && "text-destructive",
          tone === "negative" && "text-destructive",
        )}
      >
        {formatEuro(amount)}
      </p>
    </Card>
  );
}

"use client";

import {
  CaretDown,
  DownloadSimple,
  MagnifyingGlass,
  Plus,
  SlidersHorizontal,
  UploadSimple,
} from "@phosphor-icons/react";
import { amountSign } from "@finance/core/amount-sign";
import {
  categoryTypeLabels,
  TYPE_AMOUNT_CLASS,
} from "@finance/core/category-styles";
import { formatShortDate } from "@finance/core/constants";
import type { CategoryType } from "@finance/core/types/database";
import { CategoryIcon } from "@/components/finance/CategoryIcon";
import { landingSampleFor } from "@/components/marketing/landing-sample";
import { cn } from "@/lib/utils";
import { useLocale, useT } from "@/lib/locale-context";
import {
  MobileShell,
  MockMonthPicker,
  MockTabs,
  type Variant,
  WebShell,
  useEuro,
} from "@/components/marketing/mocks/frame";

/**
 * The Journal, as a landing mock (`./frame.tsx`): the three views, the
 * month, « Ajouter », then the list's card — the search, the type chips,
 * the month's totals — and the month's rows by day, newest first, each named
 * by its category with what it was under it, as `TransactionsView` lists
 * them.
 */

/** One row of the list: its category, what it was, and who added it. */
export interface LedgerRow {
  day: number;
  category: string;
  note: string;
  icon: string;
  amount: number;
  type: CategoryType;
  /** The initial of who added it, in a shared space. */
  by?: string;
}

/** Rows gathered by day, newest day first, each day with its net. */
function byDay(rows: LedgerRow[]) {
  const days = new Map<number, LedgerRow[]>();
  for (const row of rows) {
    days.set(row.day, [...(days.get(row.day) ?? []), row]);
  }
  return [...days.entries()]
    .sort(([a], [b]) => b - a)
    .map(([day, rows]) => ({
      date: `2026-03-${String(day).padStart(2, "0")}`,
      rows,
      net: rows.reduce((sum, row) => sum + row.amount, 0),
    }));
}

function DayList({ rows, compact }: { rows: LedgerRow[]; compact: boolean }) {
  const locale = useLocale();
  const t = useT();
  const euro = useEuro();
  // The sample is seen from the 19th of March, whatever today is, so its
  // « Aujourd'hui » is said here rather than by `relativeDayLabel`.
  const label = (date: string) =>
    date === "2026-03-19" ? t("calendar.today") : formatShortDate(date, locale);
  return (
    <div className={cn("flex flex-col", compact ? "gap-3" : "gap-4")}>
      {byDay(rows).map((day) => (
        <div key={day.date} className="flex flex-col gap-1">
          <div className="flex items-baseline justify-between gap-3">
            <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {label(day.date)}
            </h3>
            <span className="text-xs tabular-nums text-muted-foreground">
              {day.net >= 0 ? "+" : "−"}
              {euro(Math.abs(day.net))}
            </span>
          </div>
          <div className="divide-y divide-border">
            {day.rows.map((row) => (
              <div
                key={row.note}
                className="flex items-center justify-between gap-3 py-2.5"
              >
                <span className="flex min-w-0 items-center gap-3">
                  <span className="relative shrink-0">
                    <CategoryIcon
                      icon={row.icon}
                      className="size-9 shrink-0 rounded-control border-0 bg-muted"
                    />
                    {row.by ? (
                      <span className="absolute -bottom-1 -right-1 flex size-4 items-center justify-center rounded-full border border-background bg-foreground text-[8px] font-semibold leading-none text-background">
                        {row.by}
                      </span>
                    ) : null}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">
                      {row.category}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {row.note}
                    </span>
                  </span>
                </span>
                <span
                  className={cn(
                    "shrink-0 whitespace-nowrap text-sm tabular-nums",
                    TYPE_AMOUNT_CLASS[row.type],
                  )}
                >
                  {amountSign(row.type)}
                  {euro(Math.abs(row.amount))}
                </span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/** « Tous les types », then one chip per kind of money, the first lit. */
function TypeChips() {
  const t = useT();
  const labels = categoryTypeLabels(useLocale());
  return (
    <div className="flex min-w-0 flex-1 gap-1.5 overflow-hidden">
      {[
        t("ledger.allTypes"),
        labels.income,
        labels.expense,
        labels.savings,
        labels.investment,
      ].map((label, index) => (
        <span
          key={label}
          className={cn(
            "shrink-0 rounded-full border px-3 py-1 text-xs font-medium",
            index === 0
              ? "border-foreground bg-foreground text-background"
              : "border-border text-muted-foreground",
          )}
        >
          {label}
        </span>
      ))}
    </div>
  );
}

function Search({ withFilters }: { withFilters: boolean }) {
  const t = useT();
  const dropdown = (label: string) => (
    <span className="flex h-9 w-44 items-center justify-between rounded-full border border-border px-3 text-sm text-muted-foreground">
      {label}
      <CaretDown size={12} />
    </span>
  );
  return (
    <div className="flex items-center gap-2">
      <span className="relative flex h-9 min-w-0 flex-1 items-center rounded-full border border-border bg-background pl-9 pr-3 text-sm text-muted-foreground">
        <MagnifyingGlass
          size={16}
          weight="light"
          className="absolute left-3.5 top-1/2 -translate-y-1/2"
        />
        <span className="truncate">{t("ledger.searchPlaceholder")}</span>
      </span>
      {withFilters ? (
        <>
          {dropdown(t("ledger.allCategories"))}
          {dropdown(t("ledger.allAccounts"))}
        </>
      ) : (
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full border border-border text-muted-foreground">
          <SlidersHorizontal size={16} weight="light" />
        </span>
      )}
    </div>
  );
}

/** The month's two totals, as the list states them over its rows. */
function Totals({
  count,
  income,
  spent,
}: {
  count: number | null;
  income: number;
  spent: number;
}) {
  const t = useT();
  const euro = useEuro();
  return (
    <div className="flex items-baseline justify-between gap-6 border-t border-border pt-3 text-sm">
      {count !== null ? (
        <p className="text-muted-foreground">
          {t("ledger.entryCount", { count })}
        </p>
      ) : null}
      <p className="flex gap-5">
        <span>
          <span className="text-muted-foreground">{t("ledger.in")} </span>
          <span className="tabular-nums text-success">{euro(income)}</span>
        </span>
        <span>
          <span className="text-muted-foreground">{t("ledger.out")} </span>
          <span className="tabular-nums text-destructive">{euro(spent)}</span>
        </span>
      </p>
    </div>
  );
}

const LEDGER_VIEWS = [
  "nav.ledgerList",
  "nav.ledgerCalendar",
  "nav.ledgerByCategory",
] as const;

/**
 * The list view of the Journal for any month's rows: the Journal's own, or
 * the shared space's under « Commun », where each row says who added it.
 */
export function LedgerMock({
  variant,
  rows,
  income,
  spent,
  count,
  space = false,
}: {
  variant: Variant;
  rows: LedgerRow[];
  income: number;
  spent: number;
  count: number;
  space?: boolean;
}) {
  const t = useT();
  const { monthLabel } = landingSampleFor(useLocale());

  if (variant === "mobile") {
    return (
      <MobileShell active="nav.ledger" space={space}>
        <MockTabs labels={[...LEDGER_VIEWS]} compact />
        <div className="flex flex-col items-center gap-1">
          <MockMonthPicker label={monthLabel} compact />
          <span className="text-xs text-muted-foreground">
            {t("common.thisMonth")}
          </span>
        </div>
        <Search withFilters={false} />
        <TypeChips />
        <Totals count={null} income={income} spent={spent} />
        <DayList rows={rows} compact />
      </MobileShell>
    );
  }

  return (
    <WebShell active="nav.ledger" space={space}>
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        <MockTabs labels={[...LEDGER_VIEWS]} />
        <MockMonthPicker label={monthLabel} />
        <span className="flex items-center gap-2 justify-self-end rounded-full border border-primary-rim bg-primary py-1 pl-4 pr-1 text-sm font-medium text-primary-foreground">
          {t("ledger.add")}
          <span className="flex size-[30px] items-center justify-center rounded-full bg-black/10">
            <Plus size={16} weight="bold" />
          </span>
        </span>
      </div>
      <section className="flex flex-col gap-4 rounded-card border border-border bg-card p-5">
        <div className="flex flex-col gap-3">
          <Search withFilters />
          <div className="flex items-center gap-4">
            <TypeChips />
            <span className="flex shrink-0 items-center gap-3 text-sm text-foreground">
              {t("ledger.select")}
              <DownloadSimple size={16} weight="light" />
              <UploadSimple size={16} weight="light" />
            </span>
          </div>
        </div>
        <Totals count={count} income={income} spent={spent} />
        <DayList rows={rows} compact={false} />
      </section>
    </WebShell>
  );
}

export function TransactionsMock({ variant = "web" }: { variant?: Variant }) {
  const { transactions, income, spent, entries } =
    landingSampleFor(useLocale());
  return (
    <LedgerMock
      variant={variant}
      rows={transactions.map((row) => ({
        day: row.day,
        category: row.meta,
        note: row.name,
        icon: row.icon,
        amount: row.amount,
        type: row.type,
      }))}
      income={income}
      spent={spent}
      count={entries}
    />
  );
}

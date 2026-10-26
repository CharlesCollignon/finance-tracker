"use client";

import { useState, type CSSProperties } from "react";
import { Sparkle } from "@phosphor-icons/react";
import { formatMonthCompact } from "@finance/core/constants";
import { MonthCloseHistory } from "@/components/finance/MonthCloseHistory";
import { MobileSheet } from "@/components/ui/MobileSheet";
import type {
  ClosedMonthRow,
  MonthCloseOverview,
} from "@/lib/queries/month-close";
import { ICON } from "@/lib/icon-scale";
import { useLocale, useT } from "@/lib/locale-context";
import { useFormatCurrency } from "@/lib/use-currency";
import { cn } from "@/lib/utils";
import styles from "./months.module.css";

/** How many closed months the bars go back. */
const BARS_LENGTH = 12;

function monthOf(monthKey: string): { year: number; month: number } {
  const [year, month] = monthKey.split("-").map(Number);
  return { year: year!, month: month! };
}

/**
 * « Vos mois »: what each closed month kept, then every close with the
 * allowance and the reading day — set once, looked at rarely, so they wait
 * behind a sheet rather than sit on Le point.
 */
export function MonthsSheet({
  open,
  onOpenChange,
  overview,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  overview: MonthCloseOverview;
}) {
  const t = useT();
  return (
    <MobileSheet
      open={open}
      onOpenChange={onOpenChange}
      title={t("futurePlan.monthsTitle")}
      wide
    >
      <div className="flex flex-col gap-6">
        <MonthsBars history={overview.history} />
        <MonthCloseHistory
          history={overview.history}
          summary={overview.summary}
          unrecordedCap={overview.settings.unrecordedCap}
          closeDay={overview.settings.closeDay}
        />
      </div>
    </MobileSheet>
  );
}

/**
 * What each closed month kept, as bars, with the best one in full gold and
 * named.
 *
 * All the bars are the savings gold, because every one of them is money
 * kept — a month that kept less is a shorter bar, and one that lost money
 * goes below the line, never a different colour (The Semantic Amount Rule).
 * Each bar is a button, so a tap, the pointer or the keyboard reads its month
 * into the line above.
 */
function MonthsBars({ history }: { history: ClosedMonthRow[] }) {
  const t = useT();
  const locale = useLocale();
  const format = useFormatCurrency();
  const [active, setActive] = useState<string | null>(null);

  const rows = history
    .filter(
      (row): row is ClosedMonthRow & { kept: number } => row.kept !== null,
    )
    .slice(0, BARS_LENGTH)
    .reverse();

  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        {t("futurePlan.monthsEmpty")}
      </p>
    );
  }

  const best = rows.reduce((top, row) => (row.kept > top.kept ? row : top));
  const highest = Math.max(0, ...rows.map((row) => row.kept));
  const lowest = Math.min(0, ...rows.map((row) => row.kept));
  const range = highest - lowest || 1;
  const zero = (highest / range) * 100;
  const shown = rows.find((row) => row.monthKey === active) ?? null;
  const short = (monthKey: string) => {
    const { year, month } = monthOf(monthKey);
    return formatMonthCompact(year, month, locale);
  };

  return (
    <div className="flex flex-col gap-3">
      <p aria-live="polite" className="privacy-sensitive min-h-10 text-sm">
        {shown
          ? t("futurePlan.scrubPoint", {
              month: shown.label,
              amount: format(shown.kept),
            })
          : best.kept > 0
            ? t("futurePlan.monthsBest", {
                month: best.label,
                amount: format(best.kept),
              })
            : null}
      </p>

      <div
        role="group"
        aria-label={t("planWeb.monthsChartLabel")}
        className="relative flex h-36 items-stretch gap-1.5"
      >
        {lowest < 0 ? (
          <span
            aria-hidden
            className="pointer-events-none absolute inset-x-0 h-px bg-hairline-strong"
            style={{ top: `${zero}%` }}
          />
        ) : null}
        {rows.map((row, index) => {
          const isBest = row === best && row.kept > 0;
          const height = (Math.abs(row.kept) / range) * 100;
          const isActive = row.monthKey === active;
          return (
            <button
              key={row.monthKey}
              type="button"
              aria-label={t("futurePlan.scrubPoint", {
                month: row.label,
                amount: format(row.kept),
              })}
              aria-pressed={isActive}
              onPointerEnter={() => setActive(row.monthKey)}
              onPointerLeave={() => setActive(null)}
              onFocus={() => setActive(row.monthKey)}
              onBlur={() => setActive(null)}
              onClick={() => setActive(isActive ? null : row.monthKey)}
              className="group relative min-w-0 flex-1 rounded-control outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {isBest ? (
                <Sparkle
                  size={ICON.xs}
                  weight="fill"
                  aria-hidden
                  className={cn(
                    styles.pop,
                    "absolute left-1/2 -translate-x-1/2 text-primary",
                  )}
                  style={
                    {
                      bottom: `calc(${100 - zero + height}% + 4px)`,
                      "--delay": `${300 + index * 60}ms`,
                    } as CSSProperties
                  }
                />
              ) : null}
              <span
                aria-hidden
                className={cn(
                  "absolute inset-x-0 mx-auto max-w-6 transition-opacity duration-hover",
                  styles.bar,
                  row.kept >= 0 ? "rounded-t-[4px]" : "rounded-b-[4px]",
                  isBest ? "bg-primary" : "bg-primary/40",
                  isActive && !isBest && "bg-primary/70",
                )}
                style={
                  {
                    bottom: row.kept >= 0 ? `${100 - zero}%` : undefined,
                    top: row.kept >= 0 ? undefined : `${zero}%`,
                    height: `${Math.max(height, 1.5)}%`,
                  } as CSSProperties
                }
              />
            </button>
          );
        })}
      </div>

      <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
        <span>{short(rows[0]!.monthKey)}</span>
        {rows.length > 1 ? (
          <span>{short(rows[rows.length - 1]!.monthKey)}</span>
        ) : null}
      </div>
    </div>
  );
}

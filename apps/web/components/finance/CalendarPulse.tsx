"use client";

import { formatCalendarDate, type PulseDay } from "@finance/core/calendar";
import { AnimatedAmount } from "@/components/finance/AnimatedAmount";
import { useLocale, useT } from "@/lib/locale-context";
import { FIGURE } from "@/lib/type-scale";
import { useFormatCurrency } from "@/lib/use-currency";
import { cn } from "@/lib/utils";

/**
 * The month above its calendar, flat: its net and what came in and went
 * out, then the month itself as a strip — one bar a day, as tall as what
 * left the account, a dot where money came in, the days ahead in outline
 * for what is still planned.
 *
 * Read with the grid below, not apart from it: pointing at a bar lights its
 * day in the grid and says what the day held, pointing at a day in the grid
 * lights its bar, and a press on either picks the day. The strip is for the
 * pointer; the grid, which offers every day too, is the way in for keys and
 * screen readers, so the strip stays out of their path.
 *
 * Colours are the grid's own — what left in the expense red, what came in
 * in the income green — so the two read as one. Each bar grows from the
 * baseline on arrival, left to right, and the net counts up to its value.
 */
export function CalendarPulse({
  label,
  days,
  totals,
  stillToCome,
  selectedDate,
  hoverDate,
  onHover,
  onSelect,
}: {
  /** The month, « octobre 2026 ». */
  label: string;
  days: readonly PulseDay[];
  totals: { income: number; outflow: number; net: number };
  /** What the recurring entries still call for this month, out. */
  stillToCome: number;
  selectedDate: string;
  hoverDate: string | null;
  onHover: (date: string | null) => void;
  onSelect: (date: string) => void;
}) {
  const t = useT();
  const locale = useLocale();
  const format = useFormatCurrency();
  const scale = Math.max(
    1,
    ...days.map((day) => Math.max(day.outflow, day.plannedOutflow)),
  );
  const focus = hoverDate
    ? (days.find((day) => day.date === hoverDate) ?? null)
    : null;

  const summary = [
    t("calendarView.inAndOut", {
      income: format(totals.income),
      outflow: format(totals.outflow),
    }),
    stillToCome > 0
      ? t("calendarView.pulseStillToCome", { amount: format(stillToCome) })
      : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <section className="flex w-full min-w-0 flex-col gap-5 border-b border-border/40 pb-6">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
        <div className="min-w-0">
          <h2 className="font-head text-lg first-letter:uppercase">{label}</h2>
          <p
            aria-live="polite"
            className="privacy-sensitive mt-1 min-h-5 text-sm tabular-nums text-muted-foreground"
          >
            {focus ? dayLine(focus) : summary}
          </p>
        </div>
        <AnimatedAmount
          value={totals.net}
          startFrom={0}
          format={(value) =>
            `${value >= 0 ? "+" : "−"}${format(Math.abs(value))}`
          }
          className={cn(
            FIGURE,
            totals.net < 0 ? "text-destructive" : "text-success",
          )}
        />
      </div>

      <div
        aria-hidden
        className="flex h-16 items-end gap-[3px]"
        onMouseLeave={() => onHover(null)}
      >
        {days.map((day, index) => {
          const planned = day.outflow === 0 ? day.plannedOutflow : 0;
          const value = day.outflow || planned;
          const lit = day.date === selectedDate || day.date === hoverDate;
          return (
            <button
              key={day.date}
              type="button"
              tabIndex={-1}
              onMouseEnter={() => onHover(day.date)}
              onClick={() => onSelect(day.date)}
              className="relative flex h-full min-w-0 flex-1 cursor-pointer flex-col items-center justify-end"
            >
              {day.income > 0 || day.plannedIncome > 0 ? (
                <span
                  className={cn(
                    "pulse-dot mb-1 size-1.5 shrink-0 rounded-full transition-transform duration-hover",
                    day.income > 0
                      ? "bg-success"
                      : "border border-success/70 bg-transparent",
                    lit && "scale-150",
                  )}
                  style={{ animationDelay: `${300 + index * 14}ms` }}
                />
              ) : null}
              <span
                className={cn(
                  "pulse-bar w-full rounded-t-[3px] transition-colors duration-hover",
                  value === 0
                    ? cn(
                        "h-0.5 rounded-[1px]",
                        lit ? "bg-foreground/50" : "bg-foreground/10",
                      )
                    : day.outflow > 0
                      ? lit
                        ? "bg-destructive"
                        : "bg-destructive/40"
                      : cn(
                          "border border-b-0 border-dashed bg-transparent",
                          lit
                            ? "border-foreground/70"
                            : "border-muted-foreground/45",
                        ),
                )}
                style={{
                  ...(value > 0
                    ? { height: `${Math.max(8, (value / scale) * 80)}%` }
                    : {}),
                  animationDelay: `${index * 14}ms`,
                }}
              />
              {day.isToday ? (
                <span className="absolute -bottom-2.5 size-1 rounded-full bg-foreground" />
              ) : null}
            </button>
          );
        })}
      </div>
    </section>
  );

  function dayLine(day: PulseDay): string {
    const parts = [
      day.outflow > 0
        ? t("calendarView.pulseOut", { amount: format(day.outflow) })
        : null,
      day.income > 0
        ? t("calendarView.pulseIn", { amount: format(day.income) })
        : null,
      day.outflow === 0 && day.plannedOutflow > 0
        ? t("calendarView.pulsePlannedOut", {
            amount: format(day.plannedOutflow),
          })
        : null,
      day.income === 0 && day.plannedIncome > 0
        ? t("calendarView.pulsePlannedIn", {
            amount: format(day.plannedIncome),
          })
        : null,
    ].filter(Boolean);
    return `${formatCalendarDate(day.date, locale)} · ${
      parts.length > 0 ? parts.join(" · ") : t("calendarView.pulseNothing")
    }`;
  }
}

"use client";

import type { ReactNode } from "react";
import {
  ArrowDownRight,
  ArrowRight,
  CalendarDots,
  CaretRight,
  ChartPieSlice,
  Receipt,
} from "@phosphor-icons/react";
import {
  formatDayMonth,
  formatMonthLabel,
  formatShortDate,
} from "@finance/core/constants";
import { amountSign } from "@finance/core/amount-sign";
import { TYPE_AMOUNT_CLASS } from "@finance/core/category-styles";
import { CategoryIcon } from "@/components/finance/CategoryIcon";
import { landingSampleFor } from "@/components/marketing/landing-sample";
import { cn } from "@/lib/utils";
import { useLocale, useT } from "@/lib/locale-context";
import {
  MobileShell,
  MockMonthPicker,
  type Variant,
  WebShell,
  useEuro,
} from "@/components/marketing/mocks/frame";

/**
 * Le point, as a landing mock (`./frame.tsx`): the month picker, the
 * balance card — today's balance and the month's end, « Il vous reste »,
 * the month's curve and its chips — and the cards under it, as
 * `components/finance/bearing/BearingMonthView.tsx` lays them out.
 *
 * The pieces are exported for the two pages that show Le point too: the
 * month's read is its last card, and the shared space is Le point under
 * « Commun ».
 */

/** The cards' glass, as `GLASS_CARD` paints it. */
export const MOCK_GLASS = "rounded-card border border-foreground/10 bg-card/60";

/** A card of Le point with its round icon, name and arrow, as `Card` draws it. */
export function BearingCardFrame({
  icon,
  title,
  arrow = true,
  className,
  children,
}: {
  icon: ReactNode;
  title: string;
  arrow?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={cn(MOCK_GLASS, "flex flex-col gap-4 p-5", className)}>
      <header className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <span className="flex size-7 items-center justify-center rounded-full bg-muted text-foreground">
            {icon}
          </span>
          {title}
        </h2>
        {arrow ? (
          <ArrowRight size={16} className="text-muted-foreground" />
        ) : null}
      </header>
      {children}
    </section>
  );
}

/** « Il vous reste … jusqu'au … · soit … par jour », as `LeftToSpendLine`. */
function LeftToSpendLine() {
  const t = useT();
  const locale = useLocale();
  const euro = useEuro();
  const { leftToSpend } = landingSampleFor(locale);
  return (
    <div className="flex w-full items-center justify-between gap-3 rounded-control border border-border px-3 py-2.5 text-sm">
      <span className="min-w-0 text-muted-foreground">
        {t("leftToSpend.title")}{" "}
        <span className="font-semibold text-foreground tabular-nums">
          {euro(leftToSpend.amount)}
        </span>{" "}
        {t("leftToSpend.untilPayDay", {
          date: formatDayMonth(leftToSpend.through, locale),
        })}
        {" · "}
        {t("leftToSpend.perDay", { amount: euro(leftToSpend.perDay) })}
      </span>
      <CaretRight size={14} className="shrink-0 text-muted-foreground" />
    </div>
  );
}

/**
 * The month's balance as `BalanceCurve` draws it: solid to today with the
 * gold wash under it, dashed from tomorrow to the month's end, a dot where
 * money left or is set to, a ring on today and on the last day.
 */
function Curve({ height }: { height: number }) {
  const { bearingMonth: month } = landingSampleFor(useLocale());
  const { curve } = month;
  const today = 19;
  const width = 1000;
  const values = curve.map(([, value]) => value);
  const top = Math.max(...values) * 1.06;
  const bottom = Math.min(...values) * 0.7;
  const x = (day: number) => ((day - 1) / 30) * width;
  const y = (value: number) =>
    4 + (1 - (value - bottom) / (top - bottom)) * (height - 8);
  const line = (points: [number, number][]) =>
    points
      .map(([day, value], index) => {
        const [, previous] = points[index - 1] ?? [day, value];
        // A balance holds until the day it moves: a step, not a slope.
        return index === 0
          ? `M${x(day)} ${y(value)}`
          : `L${x(day)} ${y(previous)} L${x(day)} ${y(value)}`;
      })
      .join(" ");
  const past = curve.filter(([day]) => day <= today);
  const ahead = curve.filter(([day]) => day >= today);
  const area = `${line(past)} L${x(today)} ${height} L0 ${height} Z`;
  const dot = (day: number, value: number) => ({
    left: `${(x(day) / width) * 100}%`,
    top: y(value),
  });
  const [, todayValue] = past[past.length - 1]!;
  const [lastDay, lastValue] = curve[curve.length - 1]!;
  return (
    <div className="relative w-full" style={{ height }}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        className="absolute inset-0 size-full overflow-visible"
      >
        <defs>
          <linearGradient id="mock-wash" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.16" />
            <stop offset="100%" stopColor="var(--primary)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area} fill="url(#mock-wash)" />
        <path
          d={line(past)}
          fill="none"
          stroke="var(--primary)"
          strokeWidth={2}
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
        <path
          d={line(ahead)}
          fill="none"
          stroke="var(--primary)"
          strokeOpacity={0.7}
          strokeWidth={2}
          strokeDasharray="4 5"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      {curve.map(([day, value], index) =>
        index > 0 && value < curve[index - 1]![1] && day !== today ? (
          <span
            key={day}
            className={cn(
              "absolute size-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full",
              day > today ? "border border-primary/80 bg-card" : "bg-primary",
            )}
            style={dot(day, value)}
          />
        ) : null,
      )}
      <span
        className="absolute size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary ring-4 ring-card"
        style={dot(today, todayValue)}
      />
      <span
        className="absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-primary bg-card"
        style={dot(lastDay, lastValue)}
      />
    </div>
  );
}

/** The balance card, as `BalanceCard` draws it in the current month. */
export function BalanceCardMock({ compact = false }: { compact?: boolean }) {
  const t = useT();
  const locale = useLocale();
  const euro = useEuro();
  const sample = landingSampleFor(locale);
  const { bearing, bearingMonth: month } = sample;
  const delta = bearing.free - bearing.onHand;
  const date = (day: number) =>
    formatShortDate(`2026-03-${String(day).padStart(2, "0")}`, locale);

  const right = (
    <div
      className={cn(
        "flex min-w-0 gap-2",
        compact ? "items-end justify-between" : "flex-col items-end",
      )}
    >
      <div className={cn("flex flex-col gap-1", !compact && "items-end")}>
        <p className="text-sm font-medium text-muted-foreground">
          {t("bearingMonth.expectedEnd")}
        </p>
        <p className="font-serif text-3xl font-semibold tracking-tight tabular-nums">
          {euro(bearing.free)}
        </p>
      </div>
      <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2.5 py-1 text-xs font-medium text-destructive">
        <ArrowDownRight size={12} weight="bold" />
        {`−${euro(Math.abs(delta))}`}
      </span>
    </div>
  );

  return (
    <section
      className={cn(
        MOCK_GLASS,
        "flex flex-col",
        compact ? "gap-4 p-4" : "gap-5 p-8",
      )}
    >
      <div
        className={cn(
          "flex gap-5",
          compact ? "flex-col" : "items-end justify-between",
        )}
      >
        <div className="min-w-0">
          <p className="text-sm font-medium text-muted-foreground">
            {t("bearingMonth.onAccount")}
          </p>
          <p
            className={cn(
              "mt-2 font-serif font-semibold leading-[0.95] tracking-tight tabular-nums",
              compact ? "text-[2.75rem]" : "text-6xl",
            )}
          >
            {euro(bearing.onHand)}
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            {t("bearingMonth.fromClose")}
          </p>
          <p className="mt-1.5 text-xs text-muted-foreground underline decoration-dotted underline-offset-4">
            {t("bearingMonth.how.title")}
          </p>
        </div>
        {right}
      </div>
      <LeftToSpendLine />
      <Curve height={compact ? 110 : 140} />
      <div className="flex flex-wrap gap-2 text-xs">
        <span className="rounded-full border border-border px-3 py-1.5 text-muted-foreground">
          {t("bearingMonth.lowestAhead", {
            amount: euro(month.lowest.value),
            date: date(month.lowest.day),
          })}
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-muted-foreground">
          <span className="size-1.5 rounded-full bg-success" />
          {t("bearingMonth.toComeIn", { amount: euro(month.arriving) })}
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-muted-foreground">
          <span className="size-1.5 rounded-full bg-destructive" />
          {t("bearingMonth.toGoOut", { amount: euro(month.leaving) })}
        </span>
      </div>
    </section>
  );
}

/** « Dépensé »: the month so far against February, and six months of bars. */
export function SpentCardMock() {
  const t = useT();
  const locale = useLocale();
  const euro = useEuro();
  const { expenses, bearingMonth: month } = landingSampleFor(locale);
  return (
    <BearingCardFrame
      icon={<Receipt size={14} weight="bold" />}
      title={t("bearingMonth.spent")}
    >
      <p className="font-serif text-3xl font-semibold tracking-tight tabular-nums">
        {euro(expenses)}
      </p>
      <p className="text-sm text-success">
        {t("bearingMonth.spentLessSoFar", {
          amount: euro(month.spentBefore - expenses),
          month: formatMonthLabel(2026, 2, locale),
        })}
      </p>
      <div className="flex h-20 items-end gap-2">
        {month.spentTrend.map((point, index) => {
          const shown = index === month.spentTrend.length - 1;
          const peak = Math.max(...month.spentTrend.map((each) => each.total));
          return (
            <div
              key={point.month}
              className="flex h-full flex-1 flex-col items-center justify-end gap-1"
            >
              <span
                className={cn(
                  "w-full max-w-6 rounded-t-[4px]",
                  shown ? "bg-primary" : "bg-foreground/15",
                )}
                style={{ height: `${(point.total / peak) * 100}%` }}
              />
              <span
                className={cn(
                  "text-[0.6875rem] uppercase",
                  shown ? "text-foreground" : "text-muted-foreground",
                )}
              >
                {formatMonthLabel(
                  point.month > 3 ? 2025 : 2026,
                  point.month,
                  locale,
                ).slice(0, 3)}
              </span>
            </div>
          );
        })}
      </div>
    </BearingCardFrame>
  );
}

/** « Encore à venir »: the next four charges, each on its dashed date. */
export function UpcomingCardMock() {
  const t = useT();
  const locale = useLocale();
  const euro = useEuro();
  const { bearingMonth: month } = landingSampleFor(locale);
  return (
    <BearingCardFrame
      icon={<CalendarDots size={14} weight="bold" />}
      title={t("bearingMonth.stillToCome")}
    >
      <ul className="flex flex-col gap-3">
        {month.upcoming.map((charge) => (
          <li
            key={`${charge.day}-${charge.name}`}
            className="flex items-center gap-3"
          >
            <span className="flex size-10 shrink-0 flex-col items-center justify-center rounded-control border border-dashed border-hairline-strong leading-none">
              <span className="text-sm font-semibold tabular-nums">
                {charge.day}
              </span>
              <span className="mt-0.5 text-[0.625rem] uppercase text-muted-foreground">
                {formatDayMonth(`2026-03-${charge.day}`, locale).split(" ")[1]}
              </span>
            </span>
            <span className="min-w-0 flex-1 truncate text-sm">
              {charge.name}
            </span>
            <span
              className={cn(
                "shrink-0 text-sm tabular-nums",
                TYPE_AMOUNT_CLASS[charge.type],
              )}
            >
              {`${amountSign(charge.type)}${euro(charge.amount)}`}
            </span>
          </li>
        ))}
      </ul>
      <p className="text-xs text-muted-foreground">
        {t("bearingMonth.moreToCome", { count: month.upcomingMore })}
      </p>
    </BearingCardFrame>
  );
}

/** « Où c'est parti »: the month's largest categories, each with its bar. */
export function WhereItWentMock({ rows = 4 }: { rows?: number }) {
  const t = useT();
  const euro = useEuro();
  const { spendByCategory } = landingSampleFor(useLocale());
  const top = spendByCategory.slice(0, -1).slice(0, rows);
  const rest = spendByCategory
    .slice(top.length)
    .reduce((sum, row) => sum + row.amount, 0);
  const peak = Math.max(...top.map((row) => row.amount));
  return (
    <BearingCardFrame
      icon={<ChartPieSlice size={14} weight="bold" />}
      title={t("bearingMonth.whereItWent")}
    >
      <ul className="flex flex-col gap-4">
        {top.map((row) => (
          <li key={row.label} className="flex items-center gap-3">
            <CategoryIcon
              icon={row.icon}
              className="size-9 shrink-0 rounded-control border-0 bg-muted"
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-3">
                <span className="truncate text-sm font-medium">
                  {row.label}
                </span>
                <span className="shrink-0 text-sm tabular-nums">
                  {euro(row.amount)}
                </span>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-foreground/10">
                <div
                  className="h-full rounded-full bg-foreground/40"
                  style={{ width: `${(row.amount / peak) * 100}%` }}
                />
              </div>
            </div>
          </li>
        ))}
      </ul>
      {rest > 0 ? (
        <p className="flex items-center justify-between text-sm text-muted-foreground">
          <span>{t("bearingMonth.everythingElse")}</span>
          <span className="tabular-nums">{euro(rest)}</span>
        </p>
      ) : null}
    </BearingCardFrame>
  );
}

export function BearingMock({ variant = "web" }: { variant?: Variant }) {
  const locale = useLocale();
  const { monthLabel } = landingSampleFor(locale);

  if (variant === "mobile") {
    return (
      <MobileShell active="nav.bearing">
        <div className="flex justify-center">
          <MockMonthPicker label={monthLabel} compact />
        </div>
        <BalanceCardMock compact />
        <SpentCardMock />
      </MobileShell>
    );
  }

  return (
    <WebShell active="nav.bearing">
      <div className="flex justify-center">
        <MockMonthPicker label={monthLabel} />
      </div>
      <BalanceCardMock />
      <div className="grid grid-cols-2 gap-4">
        <SpentCardMock />
        <UpcomingCardMock />
      </div>
    </WebShell>
  );
}

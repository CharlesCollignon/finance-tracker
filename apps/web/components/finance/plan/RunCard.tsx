"use client";

import { useState, type CSSProperties } from "react";
import { ArrowRight, ChartBar, Flame, Sparkle } from "@phosphor-icons/react";
import { formatMonthCompact } from "@finance/core/constants";
import { monthShort } from "@finance/core/i18n/calendar-names";
import { closeInvitation, monthWasWon } from "@finance/core/month-close";
import { MonthCloseSheet } from "@/components/finance/MonthCloseSheet";
import { Button, ButtonNub } from "@/components/ui/Button";
import type {
  ClosedMonthRow,
  MonthCloseOverview,
} from "@/lib/queries/month-close";
import { ICON } from "@/lib/icon-scale";
import { useLocale, useT } from "@/lib/locale-context";
import { useFormatCurrency } from "@/lib/use-currency";
import { cn } from "@/lib/utils";
import { PlanCard } from "./plan-controls";
import styles from "./plan.module.css";

/** How many of the latest months the run's chain shows. */
const CHAIN_LENGTH = 6;
/** How many closed months the bars go back. */
const BARS_LENGTH = 12;

function monthOf(monthKey: string): { year: number; month: number } {
  const [year, month] = monthKey.split("-").map(Number);
  return { year: year!, month: month! };
}

/**
 * The run: how many months in a row have been wrapped up inside the margin,
 * the record, and the way to keep it going.
 *
 * The flame is lit while there is a run and breathes gently; it goes out,
 * grey and still, when there is none, and nothing on the card scolds. The
 * month-close itself opens from here — the same sheet the rest of the app
 * uses — because a run is only ever kept by doing the next one.
 */
export function RunCard({
  closes,
  monthlyCommitted,
}: {
  closes: MonthCloseOverview;
  monthlyCommitted: number;
}) {
  const t = useT();
  const locale = useLocale();
  const format = useFormatCurrency();
  const [open, setOpen] = useState(false);
  const { summary, history, next, settings } = closes;
  const lit = summary.streak > 0;

  const chain = history
    .filter((row) => row.status !== "baseline")
    .slice(0, CHAIN_LENGTH)
    .reverse();

  const invitation = next
    ? closeInvitation({
        isBaseline: next.isBaseline,
        unrecordedCap: settings.unrecordedCap,
        baseline: summary.baseline,
      })
    : null;
  const detail = !invitation
    ? null
    : invitation.kind === "baseline"
      ? t("monthClose.inviteBaseline")
      : invitation.kind === "allowance"
        ? t("monthClose.inviteAllowance", { cap: format(invitation.cap) })
        : invitation.kind === "normal"
          ? t("monthClose.inviteNormal", {
              amount: format(invitation.baseline),
            })
          : t("monthClose.inviteBare");

  return (
    <PlanCard
      icon={<Flame size={ICON.sm} weight="fill" />}
      title={t("futurePlan.runTitle")}
    >
      <div className="flex items-center gap-4">
        <span
          aria-hidden
          className={cn(
            "flex size-16 shrink-0 items-center justify-center rounded-full",
            lit ? cn("bg-accent", styles.glow) : "bg-muted",
          )}
        >
          <Flame
            size={ICON.hero}
            weight={lit ? "fill" : "regular"}
            className={cn(
              lit ? cn("text-primary", styles.flame) : "text-muted-foreground",
            )}
          />
        </span>
        <div className="min-w-0">
          {lit ? (
            <p className="font-head text-xl tabular-nums">
              {t("futurePlan.runCount", { count: summary.streak })}
            </p>
          ) : (
            <p className="text-sm">{t("futurePlan.runStart")}</p>
          )}
          {summary.bestStreak > 0 ? (
            <p className="mt-0.5 text-sm text-muted-foreground tabular-nums">
              {t("futurePlan.runRecord", { count: summary.bestStreak })}
            </p>
          ) : null}
        </div>
      </div>

      {chain.length > 0 ? (
        <ol className="flex items-end gap-2">
          {chain.map((row, index) => {
            const won = monthWasWon(row, settings.unrecordedCap);
            const { month } = monthOf(row.monthKey);
            return (
              <li
                key={row.monthKey}
                className="flex flex-1 flex-col items-center gap-1.5"
                aria-label={
                  won
                    ? t("planWeb.runMonthWon", { month: row.label })
                    : t("planWeb.runMonthMissed", { month: row.label })
                }
              >
                <span
                  aria-hidden
                  className={cn(
                    "block h-2 w-full rounded-full",
                    won ? cn("bg-primary", styles.pop) : "bg-foreground/10",
                  )}
                  style={
                    won
                      ? ({ "--delay": `${index * 80}ms` } as CSSProperties)
                      : undefined
                  }
                />
                <span aria-hidden className="text-xs text-muted-foreground">
                  {monthShort(month, locale)}
                </span>
              </li>
            );
          })}
        </ol>
      ) : null}

      {next ? (
        <div className="mt-auto flex flex-col gap-3 rounded-control border border-border p-3">
          <div>
            {lit ? (
              <p className="text-sm font-medium">
                {t("futurePlan.runKeep", { month: next.label })}
              </p>
            ) : null}
            {detail ? (
              <p
                className={cn(
                  "text-sm text-muted-foreground",
                  (invitation?.kind === "allowance" ||
                    invitation?.kind === "normal") &&
                    "privacy-sensitive",
                )}
              >
                {detail}
              </p>
            ) : null}
          </div>
          <Button
            variant="pill"
            size="sm"
            className="gap-3 self-start"
            onClick={() => setOpen(true)}
          >
            {next.isBaseline
              ? t("monthClose.setStartingBalance")
              : t("monthClose.closeTheMonth")}
            <ButtonNub>
              <ArrowRight size={ICON.md} />
            </ButtonNub>
          </Button>
          <MonthCloseSheet
            open={open}
            onOpenChange={setOpen}
            year={next.year}
            month={next.month}
            monthLabel={next.label}
            observeOn={next.observeOn}
            isBaseline={next.isBaseline}
            monthlyCommitted={monthlyCommitted}
            unrecordedCap={settings.unrecordedCap}
            baseline={summary.baseline}
          />
        </div>
      ) : null}
    </PlanCard>
  );
}

/**
 * What each wrapped-up month saved, as bars growing in one after another,
 * with the best one in full gold and named.
 *
 * All the bars are the savings gold, because every one of them is money
 * kept — a month that kept less is a shorter bar, and one that lost money
 * goes below the line, never a different colour (The Semantic Amount Rule).
 * Each bar is a button, so a tap, the pointer or the keyboard reads its month
 * into the line above.
 */
export function MonthsCard({ history }: { history: ClosedMonthRow[] }) {
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
      <PlanCard
        icon={<ChartBar size={ICON.sm} weight="fill" />}
        title={t("futurePlan.monthsTitle")}
      >
        <p className="text-sm text-muted-foreground">
          {t("futurePlan.monthsEmpty")}
        </p>
      </PlanCard>
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
    <PlanCard
      icon={<ChartBar size={ICON.sm} weight="fill" />}
      title={t("futurePlan.monthsTitle")}
    >
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
                  row.kept >= 0
                    ? cn(styles.bar, "rounded-t-[4px]")
                    : cn(styles.barDown, "rounded-b-[4px]"),
                  isBest ? "bg-primary" : "bg-primary/40",
                  isActive && !isBest && "bg-primary/70",
                )}
                style={
                  {
                    bottom: row.kept >= 0 ? `${100 - zero}%` : undefined,
                    top: row.kept >= 0 ? undefined : `${zero}%`,
                    height: `${Math.max(height, 1.5)}%`,
                    "--delay": `${index * 60}ms`,
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
    </PlanCard>
  );
}

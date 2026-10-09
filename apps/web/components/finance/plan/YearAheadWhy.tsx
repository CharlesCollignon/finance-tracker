"use client";

import { m, useReducedMotion } from "motion/react";
import { Info } from "@phosphor-icons/react";
import type {
  YearAheadAccountId,
  YearAheadFlow,
} from "@finance/core/year-ahead";
import { AnimatedAmount } from "@/components/finance/AnimatedAmount";
import { ICON } from "@/lib/icon-scale";
import { useT } from "@/lib/locale-context";
import { MICRO } from "@/lib/type-scale";
import { cn } from "@/lib/utils";
import { MORPH } from "./year-ahead-parts";

/** The two ways money leaves for good, quieter than any account. */
const COMMITTED_COLOR =
  "color-mix(in oklab, var(--muted-foreground) 45%, transparent)";
const EVERYDAY_COLOR =
  "color-mix(in oklab, var(--muted-foreground) 28%, transparent)";

interface Segment {
  key: string;
  label: string;
  /** Signed: what it does to the month. */
  amount: number;
  color: string;
  /** The band it points at on the chart, if it is an account. */
  account: YearAheadAccountId | null;
  hint?: string;
}

/**
 * Why the money ends up where the chart puts it: a month's income as one
 * bar, cut into what the charges take, what everyday spending takes, what
 * goes into each account in that account's colour, and what is left on the
 * current account. Under it, in one sentence, what interest and returns add
 * by the end of the window.
 *
 * Pointing at an account's row lights its band on the chart and dims the
 * rest, so the bar and the bands read as one picture.
 */
export function YearAheadWhy({
  flow,
  everydayCounted,
  endLabel,
  color,
  name,
  onFocus,
  format,
}: {
  flow: YearAheadFlow;
  /** "septembre 2027": where the window ends, for the returns' sentence. */
  endLabel: string;
  /** Whether enough months are closed for everyday spending to be measured. */
  everydayCounted: boolean;
  color: (id: YearAheadAccountId) => string;
  name: (id: YearAheadAccountId) => string;
  onFocus: (id: YearAheadAccountId | null) => void;
  format: (value: number) => string;
}) {
  const t = useT();
  const reduce = useReducedMotion() ?? false;
  const money = (value: number) => format(Math.round(value));
  const signed = (value: number) =>
    `${value >= 0 ? "+" : "−"}${money(Math.abs(value))}`;

  const segments: Segment[] = [
    {
      key: "committed",
      label: t("futurePlan.flowCommitted"),
      amount: -flow.committed,
      color: COMMITTED_COLOR,
      account: null,
    },
    ...(everydayCounted && flow.everyday > 0
      ? [
          {
            key: "everyday",
            label: t("futurePlan.flowEveryday"),
            amount: -flow.everyday,
            color: EVERYDAY_COLOR,
            account: null,
          },
        ]
      : []),
    ...flow.into.map((row) => ({
      key: row.id,
      label: name(row.id),
      amount: row.monthly,
      color: color(row.id),
      account: row.id,
      hint: row.id === "elsewhere" ? t("futurePlan.elsewhereHint") : undefined,
    })),
    {
      key: "current",
      label:
        flow.current >= 0
          ? t("futurePlan.flowCurrentStays")
          : t("futurePlan.flowCurrentFalls"),
      amount: flow.current,
      color: color("current"),
      account: "current",
    },
  ];

  // The bar is the month's income; when more goes out than comes in, it is
  // the outgoings, so every piece still fits.
  const widthOf = (segment: Segment) =>
    segment.key === "current"
      ? Math.max(0, segment.amount)
      : Math.abs(segment.amount);
  const scale = Math.max(
    flow.income,
    segments.reduce((sum, segment) => sum + widthOf(segment), 0),
    1,
  );

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <p className="privacy-sensitive text-sm text-muted-foreground">
        {t("futurePlan.whyLeadIncome", { amount: money(flow.income) })}
      </p>

      <div
        aria-hidden
        className="flex h-3 w-full gap-0.5 overflow-hidden rounded-full bg-muted/40"
      >
        {segments.map((segment, index) => {
          const width = (widthOf(segment) / scale) * 100;
          return (
            <m.span
              key={segment.key}
              initial={{ width: "0%" }}
              animate={{ width: `${width.toFixed(2)}%` }}
              transition={
                reduce ? { duration: 0 } : { ...MORPH, delay: index * 0.05 }
              }
              className="h-full shrink-0 first:rounded-l-full last:rounded-r-full"
              style={{ background: segment.color }}
            />
          );
        })}
      </div>

      {/* Two columns on a wide card, so the rows use its width and each
          label stays a short look from its amount. */}
      <ul className="lg:columns-2 lg:gap-x-12">
        {segments.map((segment) => (
          <li
            key={segment.key}
            onPointerEnter={() => segment.account && onFocus(segment.account)}
            onPointerLeave={() => onFocus(null)}
            className={cn(
              "-mx-2 flex min-h-9 break-inside-avoid flex-col justify-center rounded-control px-2",
              segment.account &&
                "transition-colors duration-hover hover:bg-muted/50",
            )}
          >
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="flex min-w-0 items-center gap-2">
                <span
                  aria-hidden
                  className="size-2.5 shrink-0 rounded-full"
                  style={{ background: segment.color }}
                />
                <span className="truncate">{segment.label}</span>
                {segment.hint ? (
                  <span title={segment.hint} className="text-muted-foreground">
                    <Info size={ICON.sm} aria-label={segment.hint} />
                  </span>
                ) : null}
              </span>
              <AnimatedAmount
                value={segment.amount}
                format={signed}
                className={cn(
                  "shrink-0 tabular-nums",
                  segment.key === "current" &&
                    segment.amount < 0 &&
                    "text-destructive",
                )}
              />
            </div>
          </li>
        ))}
      </ul>

      {!everydayCounted ? (
        <p className={cn(MICRO, "text-muted-foreground")}>
          {t("futurePlan.flowEverydayUnmeasured")}
        </p>
      ) : null}

      {Math.round(flow.growth) > 0 ? (
        <p className="privacy-sensitive text-sm text-muted-foreground">
          {t("futurePlan.flowGrowthLine", {
            amount: money(flow.growth),
            month: endLabel,
          })}
        </p>
      ) : null}
    </div>
  );
}

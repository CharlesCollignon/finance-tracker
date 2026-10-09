"use client";

import { formatMonthLabel, formatShortDate } from "@finance/core/constants";
import { balanceExplanation } from "@finance/core/month-balance";
import type { BearingMonth } from "@/lib/bearing/month";
import { AnimatedAmount } from "@/components/finance/AnimatedAmount";
import { DcaStrip } from "@/components/finance/DcaStrip";
import { BalanceCurve } from "@/components/finance/bearing/BalanceCurve";
import { LeftToSpendLine } from "@/components/finance/bearing/LeftToSpendLine";
import { PrivateAmount } from "@/components/layout/PrivateAmount";
import { GLASS_CARD, GLASS_HERO } from "@/lib/glass";
import { FIGURE, FIGURE_HERO } from "@/lib/type-scale";
import { useFormatCurrency } from "@/lib/use-currency";
import { cn } from "@/lib/utils";
import { useLocale, useT } from "@/lib/locale-context";
import { DeltaChip } from "@/components/finance/bearing/card-parts";

/* ------------------------------------------------------------ the balance */

export function BalanceCard({ data }: { data: BearingMonth }) {
  const t = useT();
  const locale = useLocale();
  const format = useFormatCurrency();
  const { balance, source, upcoming } = data;
  const net = balance.basis === "net";
  const monthLabel = formatMonthLabel(data.year, data.month, locale);

  // The two figures, named by what they can claim.
  const figures = (() => {
    if (balance.period === "current") {
      return {
        left: {
          label: net ? t("bearingMonth.netSoFar") : t("bearingMonth.onAccount"),
          value: balance.today ?? 0,
        },
        right: {
          label: net
            ? t("bearingMonth.netByEnd")
            : t("bearingMonth.expectedEnd"),
          value: balance.end,
        },
        delta: (balance.end ?? 0) - (balance.today ?? 0),
      };
    }
    if (balance.period === "past") {
      return net
        ? { left: { label: t("bearingMonth.netMonth"), value: balance.end } }
        : {
            left: {
              label: t("bearingMonth.startedWith"),
              value: balance.start,
            },
            right: { label: t("bearingMonth.endedWith"), value: balance.end },
            delta: balance.end - balance.start,
          };
    }
    return net
      ? { left: { label: t("bearingMonth.netByEnd"), value: balance.end } }
      : {
          left: {
            label: t("bearingMonth.expectedStart"),
            value: balance.start,
          },
          right: { label: t("bearingMonth.expectedEnd"), value: balance.end },
          delta: balance.end - balance.start,
        };
  })();

  const caption =
    balance.period === "future"
      ? t("bearingMonth.plannedOnly")
      : net
        ? t("bearingMonth.netCaption")
        : source === "bank"
          ? t("bearingMonth.fromBank")
          : source === "reading"
            ? t("bearingMonth.fromReading")
            : t("bearingMonth.fromClose");

  // Only for a balance. A month's running net dips below zero every month
  // before payday, and flagging that as the account's lowest point would be
  // an alarm about a figure that is not a balance at all.
  const lowest = balance.lowest;
  const showLowest =
    !net &&
    lowest !== null &&
    !past(balance) &&
    lowest.value < Math.min(balance.end, balance.today ?? balance.start);
  // Red only where a balance is below zero — an overdrawn account. A net
  // below zero is spending before income, which is most of every month.
  const overdrawn = (value: number) => !net && value < 0;

  return (
    <section
      className={cn(
        GLASS_CARD,
        GLASS_HERO,
        "flex flex-col gap-5 rounded-card p-card md:gap-6 md:p-8",
      )}
    >
      <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-5">
        <div className="min-w-0">
          <p className="text-sm font-medium text-muted-foreground">
            {figures.left.label}
          </p>
          <AnimatedAmount
            value={figures.left.value}
            format={format}
            className={cn(
              FIGURE_HERO,
              "mt-2 block",
              overdrawn(figures.left.value) && "text-destructive",
            )}
          />
          <p className="mt-2 text-xs text-muted-foreground">{caption}</p>
          {/* With several current accounts, the figure read from the bank
              taken apart: the day it was read, which is today or the
              month's last. */}
          {data.accounts && balance.period !== "future" ? (
            <details className="mt-1.5 text-xs text-muted-foreground">
              <summary className="cursor-pointer list-none underline decoration-dotted underline-offset-4 transition-colors duration-hover hover:text-foreground [&::-webkit-details-marker]:hidden">
                {balance.period === "past"
                  ? t("bearingMonth.byAccountEnd")
                  : t("bearingMonth.byAccount")}
              </summary>
              <ul className="mt-2 flex max-w-xs flex-col gap-1">
                {data.accounts.map((account) => (
                  <li
                    key={account.name}
                    className="flex items-baseline justify-between gap-6"
                  >
                    <span className="min-w-0 truncate">{account.name}</span>
                    <PrivateAmount
                      className={cn(
                        "shrink-0 tabular-nums text-foreground",
                        account.amount < 0 && "text-destructive",
                      )}
                    >
                      {format(account.amount)}
                    </PrivateAmount>
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
          {/* Native disclosure: keyboard, screen reader and the open state
              are the browser's. */}
          <details className="mt-1.5 text-xs text-muted-foreground">
            <summary className="cursor-pointer list-none underline decoration-dotted underline-offset-4 transition-colors duration-hover hover:text-foreground [&::-webkit-details-marker]:hidden">
              {t("bearingMonth.how.title")}
            </summary>
            <p className="mt-2 max-w-prose leading-relaxed">
              {t(`bearingMonth.how.${balanceExplanation(balance, source)}`)}
            </p>
          </details>
        </div>

        {figures.right ? (
          <div className="flex min-w-0 flex-col items-start gap-2 sm:items-end">
            <p className="text-sm font-medium text-muted-foreground">
              {figures.right.label}
            </p>
            <AnimatedAmount
              value={figures.right.value}
              format={format}
              className={cn(
                FIGURE,
                "block",
                overdrawn(figures.right.value) && "text-destructive",
              )}
            />
            {figures.delta !== undefined ? (
              <DeltaChip
                value={figures.delta}
                label={t("bearingMonth.fromToday", {
                  amount: format(figures.delta),
                })}
              />
            ) : null}
          </div>
        ) : null}
      </div>

      {/* The question the screen is opened for at the till, in one line
          between the figures and the line they sit on. */}
      {data.left ? (
        <LeftToSpendLine
          left={data.left}
          lowest={balance.lowest}
          eachMonth={data.eachMonth}
        />
      ) : null}

      <BalanceCurve
        key={`${data.year}-${data.month}`}
        points={balance.points}
        outflows={data.outflows}
        today={balance.period === "current" ? data.today : null}
        format={format}
        label={t(
          net ? "bearingMonth.netChartLabel" : "bearingMonth.chartLabel",
          {
            month: monthLabel,
          },
        )}
      />

      {showLowest ||
      (upcoming && (upcoming.arriving > 0 || upcoming.leaving > 0)) ? (
        <div className="flex flex-wrap gap-2 text-xs">
          {showLowest && lowest ? (
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5",
                lowest.value < 0
                  ? "border-destructive/40 text-destructive"
                  : "border-border text-muted-foreground",
              )}
            >
              <PrivateAmount>
                {t(
                  balance.period === "current"
                    ? "bearingMonth.lowestAhead"
                    : "bearingMonth.lowest",
                  {
                    amount: format(lowest.value),
                    date: formatShortDate(lowest.date, locale),
                  },
                )}
              </PrivateAmount>
            </span>
          ) : null}
          {upcoming && upcoming.arriving > 0 ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-muted-foreground">
              <span aria-hidden className="size-1.5 rounded-full bg-success" />
              <PrivateAmount>
                {t("bearingMonth.toComeIn", {
                  amount: format(upcoming.arriving),
                })}
              </PrivateAmount>
            </span>
          ) : null}
          {upcoming && upcoming.leaving > 0 ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-muted-foreground">
              <span
                aria-hidden
                className="size-1.5 rounded-full bg-destructive"
              />
              <PrivateAmount>
                {t("bearingMonth.toGoOut", {
                  amount: format(upcoming.leaving),
                })}
              </PrivateAmount>
            </span>
          ) : null}
        </div>
      ) : null}

      {/* The transfer to the broker the DCAs need, one line under the
          curve it takes money out of. */}
      {data.dca ? (
        <DcaStrip month={data.dca} proposal={data.dcaProposal} />
      ) : null}
    </section>
  );
}

function past(balance: BearingMonth["balance"]): boolean {
  return balance.period === "past";
}

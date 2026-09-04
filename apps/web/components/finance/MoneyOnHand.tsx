"use client";

import Link from "next/link";
import {
  ArrowRight,
  ClockCounterClockwise,
  TrendDown,
  TrendUp,
} from "@phosphor-icons/react";
import {
  pulseExplanation,
  pulseHeadline,
  type MonthPulse,
} from "@finance/core/month-pulse";
import type { BudgetViewMode } from "@finance/core/constants";
import type { MonthComparison } from "@finance/core/month-comparison";
import { PrivateAmount } from "@/components/layout/PrivateAmount";
import { cn } from "@/lib/utils";
import { GLASS_CARD, GLASS_HERO } from "@/lib/glass";
import { useFormatCurrency } from "@/lib/use-currency";

interface MoneyOnHandProps {
  pulse: MonthPulse;
  monthLabel: string;
  /** Income and spending as recorded, which explain the figure below. */
  income: number;
  expenses: number;
  /** What the month's arithmetic leaves, for the no-bank case. */
  remaining: number;
  budgetView: BudgetViewMode;
  /** How far through the month today is, 0–1. Null for a month not running. */
  elapsed: number | null;
  comparison: MonthComparison | null;
  savingsRate: number | null;
  /** Named accounts whose balance could not be read, so the gap is visible. */
  unreadable: string[];
  /**
   * Why there is no live balance to lead with, when there is none.
   *
   * "No bank" and "this month is over" are different facts and the screen
   * used to give the first answer to both — so someone looking at August with
   * a bank connected was told to connect a bank. A past month has no balance
   * because a balance is only ever true now, which is worth saying rather
   * than papering over.
   */
  noBalanceReason?: "no-bank" | "past-month" | null;
}

/**
 * The one figure the screen leads with.
 *
 * It used to lead with "left in September" — income minus spending — which is
 * a correct answer to a question nobody asks at the till. A month can be
 * comfortably in surplus on paper while the rent leaves tomorrow and the
 * salary lands in a week, and the figure that says so is what the account
 * holds now, less what the month has already promised to take out of it.
 *
 * So the hero is money that exists, and the arithmetic that turns it into
 * "yours to spend" is shown underneath rather than hidden: a big number
 * nobody can check is a big number nobody believes. Without a bank connected
 * there is no balance to lead with, and the block falls back to the month's
 * own arithmetic and says that is what it is.
 *
 * The bar is time, not money. It says how much of the month has run, which is
 * the only honest way to read any of this halfway through.
 */
export function MoneyOnHand({
  pulse,
  monthLabel,
  income,
  expenses,
  remaining,
  budgetView,
  elapsed,
  comparison,
  savingsRate,
  unreadable,
  noBalanceReason = null,
}: MoneyOnHandProps) {
  const formatMoney = useFormatCurrency();

  const banked = pulse.onHand !== null && pulse.free !== null;
  const headlineAmount = banked ? Math.abs(pulse.free!) : Math.abs(remaining);
  const short = banked ? pulse.free! < 0 : remaining < 0;

  return (
    <section
      className={cn(
        "rounded-3xl p-5 md:p-7",
        GLASS_CARD,
        GLASS_HERO,
        // The frame carries the verdict, so the number does not have to be
        // coloured in to say it. A tight month is not a wrong month.
        pulse.standing === "short"
          ? "border-destructive/40"
          : pulse.standing === "tight"
            ? "border-primary-rim/50"
            : undefined,
      )}
    >
      <div className="flex flex-col gap-6">
        {/* Said once, loudly, at the top of the card.

            The month now follows the user between surfaces and survives a
            reload, which is what makes it worth having and also what makes it
            possible to open the app onto a month that ended. The picker in the
            header says which month, but a small "Aug 26" beside two other
            controls is not enough to stop someone reading last month's totals
            as this month's. */}
        {noBalanceReason === "past-month" ? (
          <p className="flex w-fit items-center gap-1.5 rounded-full bg-foreground/10 px-3 py-1 text-xs font-medium">
            <ClockCounterClockwise size={13} />
            {`Looking at ${monthLabel} — a month that has ended`}
          </p>
        ) : null}

        <div className="flex flex-col gap-1.5">
          <p className="text-sm text-muted-foreground">
            {banked
              ? pulseHeadline(pulse)
              : `${short ? "Over" : "Left"} in ${monthLabel}${
                  budgetView === "month_end"
                    ? ", counting what is still to come"
                    : ""
                }`}
          </p>

          {/* The figure and its change on one line, the change riding the
              baseline of the digits rather than sitting above or below them.
              Wraps rather than shrinks: on a narrow phone a six-figure
              balance and a pill do not fit, and a hero that reflows is
              better than one that truncates. */}
          <div className="flex flex-wrap items-end gap-x-3 gap-y-2">
            <PrivateAmount
              className={cn(
                "font-serif text-[2.75rem] leading-[0.95] tracking-tight tabular-nums",
                "sm:text-5xl md:text-6xl",
                short && "text-destructive",
              )}
            >
              {formatMoney(headlineAmount)}
            </PrivateAmount>
            <SpendDelta comparison={comparison} />
          </div>

          <p className="text-sm text-muted-foreground">
            {banked
              ? pulseExplanation(pulse)
              : noBalanceReason === "past-month"
                ? "A finished month, as the ledger recorded it. What an account holds is only ever true today."
                : "Connect a bank to lead with what is actually in your account."}
          </p>
        </div>

        {/* The sum, spelled out. Three terms in the order they happen to the
            account: what is there, what leaves, what arrives. */}
        {banked ? (
          <dl className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-sm">
            <Term label="In the account" amount={formatMoney(pulse.onHand!)} />
            {pulse.committed > 0 ? (
              <>
                <Operator>−</Operator>
                <Term
                  label="still to leave"
                  amount={formatMoney(pulse.committed)}
                  tone="out"
                />
              </>
            ) : null}
            {pulse.arriving > 0 ? (
              <>
                <Operator>+</Operator>
                <Term
                  label="still to arrive"
                  amount={formatMoney(pulse.arriving)}
                  tone="in"
                />
              </>
            ) : null}
          </dl>
        ) : null}

        {elapsed !== null ? (
          <div className="flex flex-col gap-1.5">
            <div
              className="h-1.5 w-full overflow-hidden rounded-full bg-foreground/10"
              role="img"
              aria-label={`${Math.round(elapsed * 100)}% of the month elapsed`}
            >
              <div
                className="h-full rounded-full bg-gradient-to-r from-primary-rim to-primary"
                style={{ width: `${Math.min(100, elapsed * 100)}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              {`${Math.round(elapsed * 100)}% of ${monthLabel} gone`}
            </p>
          </div>
        ) : null}

        {/* Rows rather than columns. Three figures side by side is a tidy
            desktop layout that wraps into an unreadable stagger on a phone,
            and the reference this screen was drawn from puts its secondary
            figures in exactly this shape: label left, value right, hairline
            between. */}
        <dl className="flex flex-col border-t border-foreground/10">
          <Figure label="Came in" value={formatMoney(income)} icon="in" />
          <Figure label="Went out" value={formatMoney(expenses)} icon="out" />
          {savingsRate !== null ? (
            <Figure
              label="Savings rate"
              value={`${savingsRate}%`}
              /* Not "kept": a month close already uses that word for cash
                 left plus what was set aside, a different figure. */
              plain
            />
          ) : null}
        </dl>

        {/* A balance that could not be read is the one thing here that must
            never be silent: the figures above would simply be short by
            whatever that account holds. */}
        {unreadable.length > 0 ? (
          <p className="text-sm text-destructive">
            {`Could not read ${unreadable.join(", ")} — ${
              unreadable.length === 1 ? "its balance is" : "their balances are"
            } not counted above.`}
            <Link
              href="/budgets"
              className="ml-1 inline-flex items-center gap-1 text-primary-ink"
            >
              Fix
              <ArrowRight size={12} />
            </Link>
          </p>
        ) : null}
      </div>
    </section>
  );
}

/**
 * Spending against the same stretch of last month, as a pill.
 *
 * The reference wears its change as a gold badge beside the figure, and the
 * shape is worth borrowing — but not the reading. That badge is a gain, where
 * this is spending, so the sign has to be read the other way round: less than
 * last month is the good news, and it is the one that gets the colour.
 *
 * Absent when there is nothing fair to compare with. A first month has no
 * previous one, and an unqualified "+100%" against a month with two
 * transactions in it would be technically true and useless.
 */
function SpendDelta({ comparison }: { comparison: MonthComparison | null }) {
  if (
    !comparison ||
    !comparison.comparable ||
    comparison.ratio === null ||
    comparison.direction === "flat"
  ) {
    return null;
  }

  const down = comparison.direction === "down";
  const percent = Math.abs(Math.round(comparison.ratio * 100));

  return (
    <span
      className={cn(
        "mb-1.5 inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1",
        "text-xs font-semibold tabular-nums",
        down
          ? "bg-success/15 text-success"
          : "bg-primary/20 text-primary-ink dark:text-primary",
      )}
      title={`Spending ${down ? "down" : "up"} ${percent}% against the same days of ${comparison.previousLabel}`}
    >
      {down ? (
        <TrendDown size={12} weight="bold" />
      ) : (
        <TrendUp size={12} weight="bold" />
      )}
      {`${down ? "−" : "+"}${percent}%`}
    </span>
  );
}

function Operator({ children }: { children: string }) {
  return (
    <span aria-hidden className="px-1 text-muted-foreground">
      {children}
    </span>
  );
}

function Term({
  label,
  amount,
  tone,
}: {
  label: string;
  amount: string;
  tone?: "in" | "out";
}) {
  return (
    <span className="inline-flex items-baseline gap-1.5">
      <PrivateAmount
        className={cn(
          "tabular-nums",
          tone === "in" && "text-success",
          tone === "out" && "text-destructive",
        )}
      >
        {amount}
      </PrivateAmount>
      <span className="text-muted-foreground">{label}</span>
    </span>
  );
}

function Figure({
  label,
  value,
  icon,
  plain = false,
}: {
  label: string;
  value: string;
  icon?: "in" | "out";
  plain?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-foreground/10 py-2.5 last:border-0">
      <dt className="flex items-center gap-1.5 text-sm text-muted-foreground">
        {icon === "in" ? (
          <TrendUp size={13} className="text-success" />
        ) : icon === "out" ? (
          <TrendDown size={13} className="text-destructive" />
        ) : null}
        {label}
      </dt>
      {plain ? (
        <dd className="tabular-nums">{value}</dd>
      ) : (
        <PrivateAmount className="tabular-nums">{value}</PrivateAmount>
      )}
    </div>
  );
}

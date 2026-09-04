"use client";

import Link from "next/link";
import {
  ArrowRight,
  Check,
  Flame,
  Trophy,
  Warning,
} from "@phosphor-icons/react";
import type { MonthPulse } from "@finance/core/month-pulse";
import { PrivateAmount } from "@/components/layout/PrivateAmount";
import { cn } from "@/lib/utils";
import { GLASS_CARD } from "@/lib/glass";
import { useFormatCurrency } from "@/lib/use-currency";

interface MonthScoreProps {
  pulse: MonthPulse;
  /** Consecutive months won, up to the last close. */
  streak: number;
  /** The best run ever managed, so breaking one does not erase it. */
  bestStreak: number;
  /** Typical unrecorded spending, for a cap that has not been set yet. */
  baseline: number | null;
}

/**
 * How the month is going against the only target the app can honestly set.
 *
 * The app's one genuinely unusual claim is that it can measure the spending
 * nobody enters: the restaurant, the round of drinks, the thing bought on the
 * way home. Until now that arrived once a month, after the close, as a
 * verdict on a month already over — which is the least useful moment to hear
 * it. Given a live balance the same arithmetic runs today, so the figure
 * becomes something to play against rather than a report card.
 *
 * Deliberately not a score out of a hundred, or points, or a level. The
 * target is an amount from the user's own history and the meter fills with
 * real euros, because the moment a number stops being checkable it stops
 * changing anyone's behaviour. What is borrowed from games is only the parts
 * that survive that test: one clear target, live feedback against it, and a
 * streak worth protecting.
 *
 * Absent rather than empty when there is nothing to say. A month with no
 * balance to read from and no run of closes behind it has no standing yet,
 * and inventing one would be the first false note on the screen.
 */
export function MonthScore({
  pulse,
  streak,
  bestStreak,
  baseline,
}: MonthScoreProps) {
  const formatMoney = useFormatCurrency();

  const hasMeter = pulse.unrecordedSoFar !== null;
  const hasStreak = streak > 0 || bestStreak > 0;

  if (!hasMeter && !hasStreak && !pulse.overRecorded) {
    return null;
  }

  // The cap if the user set one; otherwise their own median, which is what a
  // cap would be suggested from anyway. Labelled differently, because one is
  // a target they chose and the other is only a description of normal.
  const target = pulse.cap ?? baseline;
  const chosen = pulse.cap !== null;
  const spent = pulse.unrecordedSoFar ?? 0;
  const ratio =
    target !== null && target > 0 ? Math.min(1.5, spent / target) : null;
  const over = target !== null && spent > target;

  return (
    <section className={cn("flex flex-col gap-4 rounded-3xl p-5", GLASS_CARD)}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-medium">Untracked spending, so far</h2>
        <div className="flex shrink-0 items-center gap-2">
          {streak > 1 ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-accent px-2 py-0.5 text-xs font-medium text-accent-foreground">
              <Flame size={12} weight="fill" />
              {`${streak} in a row`}
            </span>
          ) : null}
          {bestStreak > streak && bestStreak > 1 ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">
              <Trophy size={12} />
              {`best ${bestStreak}`}
            </span>
          ) : null}
        </div>
      </div>

      {pulse.overRecorded ? (
        <p className="flex items-start gap-1.5 text-sm text-muted-foreground">
          <Warning size={14} className="mt-0.5 shrink-0 text-destructive" />
          Your account holds more than the ledger allows — income is missing, or
          something is recorded twice. Nothing to measure until that is sorted.
        </p>
      ) : hasMeter ? (
        <div className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between gap-3">
            <PrivateAmount
              className={cn(
                "font-serif text-2xl tabular-nums",
                over && "text-destructive",
              )}
            >
              {formatMoney(spent)}
            </PrivateAmount>
            {target !== null ? (
              <span className="text-sm text-muted-foreground">
                {chosen ? "of your " : "against a usual "}
                <PrivateAmount className="tabular-nums">
                  {formatMoney(target)}
                </PrivateAmount>
                {chosen ? " cap" : ""}
              </span>
            ) : null}
          </div>

          {ratio !== null ? (
            <div
              className="h-2 w-full overflow-hidden rounded-full bg-foreground/10"
              role="img"
              aria-label={`${formatMoney(spent)} of ${formatMoney(target!)}`}
            >
              <div
                className={cn(
                  "h-full rounded-full transition-[width] duration-500",
                  over ? "bg-destructive" : "bg-success",
                )}
                // Capped at the full width: a bar drawn past its own track
                // reads as a rendering bug rather than as an overspend, and
                // the amount above already says by how much.
                style={{ width: `${Math.min(100, ratio * 100)}%` }}
              />
            </div>
          ) : null}

          <p
            className={cn(
              "flex items-start gap-1.5 text-sm",
              over ? "text-muted-foreground" : "text-success",
            )}
          >
            {over ? null : (
              <Check size={14} weight="bold" className="mt-0.5 shrink-0" />
            )}
            {target === null
              ? "Close two months and the app will know what normal looks like for you."
              : over
                ? `${formatMoney(spent - target)} past it, with the month still running.`
                : `${formatMoney(target - spent)} of room left this month.`}
          </p>

          <p className="text-xs text-muted-foreground">
            Measured against your last close, not remembered — so it moves when
            the bank does, and it is not final until the month is closed.
          </p>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          Close a month against your bank balance and this fills in: the app
          works out what left the account that no entry explains.
        </p>
      )}

      <Link
        href="/budgets"
        className="flex w-fit items-center gap-1 text-sm text-primary-ink"
      >
        {hasStreak ? "Every month you have closed" : "Set this up"}
        <ArrowRight size={13} />
      </Link>
    </section>
  );
}

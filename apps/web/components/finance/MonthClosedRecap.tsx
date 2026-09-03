"use client";

import Link from "next/link";
import { ArrowRight, Check, Flame } from "@phosphor-icons/react";
import type { ClosedMonthRow } from "@/lib/queries/month-close";
import { PrivateAmount } from "@/components/layout/PrivateAmount";
import { cn } from "@/lib/utils";
import { useFormatCurrency } from "@/lib/use-currency";

interface MonthClosedRecapProps {
  row: ClosedMonthRow;
  streak: number;
  /** What counts as an acceptable amount of unrecorded spending. */
  cap: number | null;
}

/**
 * What last month came to, once nobody had to be asked.
 *
 * Closing a month used to mean reading a balance off a banking app and typing
 * it in — the only thing in Pluclair that asked for a number it could not
 * work out. Where a bank is connected it can work it out, so the close now
 * happens on its own and this reports it rather than requesting it.
 *
 * Deliberately read-only, and deliberately still here. The reconciliation is
 * the one place the app admits how much it does not know, and hiding that
 * because it is now automatic would turn a claim the user could check into
 * one they simply have to trust.
 */
export function MonthClosedRecap({ row, streak, cap }: MonthClosedRecapProps) {
  const formatMoney = useFormatCurrency();

  if (row.source !== "bank" || row.status === "baseline") {
    return null;
  }

  const unrecorded = row.unrecorded ?? 0;
  const withinCap = cap === null ? unrecorded < 0.01 : unrecorded <= cap;

  return (
    <section className="flex flex-col gap-4 rounded-xl border border-border bg-card p-5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-medium">{`${row.label} closed`}</h2>
        {streak > 1 ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-accent px-2 py-0.5 text-xs font-medium text-accent-foreground">
            <Flame size={12} weight="fill" />
            {`${streak} in a row`}
          </span>
        ) : null}
      </div>

      <div className="flex flex-col gap-2">
        {row.cashChange !== null ? (
          <p className="text-sm text-muted-foreground">
            Your account moved{" "}
            <PrivateAmount className="tabular-nums text-foreground">
              {`${row.cashChange >= 0 ? "+" : "−"}${formatMoney(Math.abs(row.cashChange))}`}
            </PrivateAmount>
            {" over the month."}
          </p>
        ) : null}

        <p
          className={cn(
            "flex items-center gap-1.5 text-sm",
            withinCap ? "text-success" : "text-muted-foreground",
          )}
        >
          {withinCap ? <Check size={14} weight="bold" /> : null}
          {row.status === "over-recorded"
            ? "The ledger recorded more than the account moved — something is counted twice."
            : unrecorded < 0.01
              ? "The ledger accounts for all of it."
              : `${formatMoney(unrecorded)} of it the ledger cannot account for.`}
        </p>
      </div>

      {row.kept !== null ? (
        <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1 border-t border-border pt-3">
          <span className="text-sm text-muted-foreground">
            {`Kept in ${row.label.split(" ")[0]}`}
          </span>
          <PrivateAmount
            className={cn(
              "font-head text-xl tabular-nums",
              row.kept < 0 && "text-destructive",
            )}
          >
            {formatMoney(row.kept)}
          </PrivateAmount>
          {row.keptRate !== null ? (
            <span className="text-sm text-muted-foreground">
              {`${row.keptRate}% of what came in`}
            </span>
          ) : null}
        </div>
      ) : null}

      <Link
        href="/budgets"
        className="flex w-fit items-center gap-1 text-sm text-primary-ink"
      >
        Every month you have closed
        <ArrowRight size={13} />
      </Link>
    </section>
  );
}

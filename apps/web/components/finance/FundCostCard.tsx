"use client";

import { useMemo } from "react";
import {
  buildFundCosts,
  costOverYears,
  formatCharge,
  savingAtCheapest,
} from "@finance/core/fund-costs";
import { INVESTMENT_WALLET_LABELS } from "@finance/core/investments";
import type { InvestmentPortfolioSummary } from "@finance/core/investment-positions";
import { Card } from "@/components/retroui/Card";
import { useFormatCurrency } from "@/lib/use-currency";
import { cn } from "@/lib/utils";

/** Long enough to make the drag visible, short enough to stay believable. */
const HORIZON_YEARS = 10;

interface FundCostCardProps {
  portfolio: InvestmentPortfolioSummary;
}

/**
 * What the portfolio costs to hold.
 *
 * Fund charges are the largest controllable cost in a long-term portfolio and
 * the only one that never appears anywhere: they come out of the fund's value
 * continuously. 0.38% sounds like nothing; €76 a year does not, which is the
 * entire reason this card exists.
 *
 * The comparison is against the cheapest fund the user already holds — their
 * own data. No market benchmark is asserted, because the app has no business
 * claiming what a fair charge is.
 */
export function FundCostCard({ portfolio }: FundCostCardProps) {
  const formatEuro = useFormatCurrency();

  const summary = useMemo(
    () =>
      buildFundCosts(
        portfolio.columns.flatMap((column) =>
          column.items.map((item) => ({
            positionId: item.id,
            name: item.name,
            walletId: item.walletId,
            marketValue: item.marketValue,
            ongoingCharge: item.ongoingCharge,
          })),
        ),
      ),
    [portfolio],
  );

  if (summary.rows.length === 0) {
    return null;
  }

  const saving = savingAtCheapest(summary);
  const priced = summary.rows.filter((row) => row.ongoingCharge !== null);

  return (
    <Card.Bezel className="w-full" innerClassName="p-5 md:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="font-head text-base">What holding this costs</h2>
        {summary.weightedAverage !== null ? (
          <p className="text-sm text-muted-foreground">
            {formatCharge(summary.weightedAverage)} a year, weighted
          </p>
        ) : null}
      </div>

      {priced.length === 0 ? (
        <p className="mt-3 max-w-prose text-sm text-muted-foreground">
          Add each holding&apos;s ongoing charge — the yearly fee on its KID —
          and this becomes a figure in euros. It is the biggest cost most
          portfolios have and the only one that never shows up on a statement.
        </p>
      ) : (
        <>
          <p className="mt-3 font-serif text-3xl font-semibold tabular-nums md:text-4xl">
            <span className="privacy-amount">
              {formatEuro(summary.totalAnnualCost)}
            </span>
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            a year on{" "}
            <span className="privacy-amount tabular-nums">
              {formatEuro(summary.coveredValue)}
            </span>{" "}
            · {formatEuro(costOverYears(summary.totalAnnualCost, HORIZON_YEARS))}{" "}
            over {HORIZON_YEARS} years at this balance
          </p>

          <ul className="mt-4 flex flex-col divide-y divide-border border-t border-border">
            {priced.map((row) => (
              <li
                key={row.positionId}
                className="flex items-baseline justify-between gap-3 py-2 text-sm"
              >
                <span className="min-w-0 flex-1 truncate">
                  {row.name}
                  <span className="ml-2 text-xs text-muted-foreground">
                    {INVESTMENT_WALLET_LABELS[row.walletId]}
                  </span>
                </span>
                <span className="shrink-0 font-mono text-xs text-muted-foreground">
                  {formatCharge(row.ongoingCharge)}
                </span>
                <span className="privacy-amount w-20 shrink-0 text-right font-mono tabular-nums">
                  {formatEuro(row.annualCost ?? 0)}
                </span>
              </li>
            ))}
          </ul>

          {saving !== null && summary.cheapest ? (
            <p className="mt-4 border-t border-border pt-4 text-sm text-muted-foreground">
              Your cheapest holding is{" "}
              <span className="text-foreground">{summary.cheapest.name}</span>{" "}
              at {formatCharge(summary.cheapest.ongoingCharge)}. At that rate
              the same{" "}
              <span className="tabular-nums">
                {formatEuro(summary.coveredValue)}
              </span>{" "}
              would cost{" "}
              <span className="tabular-nums text-foreground">
                {formatEuro(summary.costAtCheapest ?? 0)}
              </span>{" "}
              — a difference of{" "}
              <span className="font-medium tabular-nums text-foreground">
                {formatEuro(saving)}
              </span>{" "}
              a year.
            </p>
          ) : null}
        </>
      )}

      {summary.missingCount > 0 ? (
        <p
          className={cn(
            "text-sm text-muted-foreground",
            priced.length === 0 ? "mt-4" : "mt-4 border-t border-border pt-4",
          )}
        >
          {summary.missingCount}{" "}
          {summary.missingCount === 1 ? "holding has" : "holdings have"} no
          charge recorded
          {summary.uncoveredValue > 0 ? (
            <>
              {" "}
              (
              <span className="privacy-amount tabular-nums">
                {formatEuro(summary.uncoveredValue)}
              </span>
              )
            </>
          ) : null}
          , so this total is partial.
        </p>
      ) : null}
    </Card.Bezel>
  );
}

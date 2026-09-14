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
import { useT } from "@/lib/locale-context";
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
  const t = useT();
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
        <h2 className="font-head text-base">{t("fundCost.title")}</h2>
        {summary.weightedAverage !== null ? (
          <p className="text-sm text-muted-foreground">
            {formatCharge(summary.weightedAverage)}{" "}
            {t("fundCost.weightedSuffix")}
          </p>
        ) : null}
      </div>

      {priced.length === 0 ? (
        <p className="mt-3 max-w-prose text-sm text-muted-foreground">
          {t("fundCost.emptyBody")}
        </p>
      ) : (
        <>
          <p className="mt-3 font-serif text-3xl font-semibold tabular-nums md:text-4xl">
            <span className="privacy-amount">
              {formatEuro(summary.totalAnnualCost)}
            </span>
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("fundCost.aYearOn")}{" "}
            <span className="privacy-amount tabular-nums">
              {formatEuro(summary.coveredValue)}
            </span>{" "}
            · {formatEuro(costOverYears(summary.totalAnnualCost, HORIZON_YEARS))}{" "}
            {t("fundCost.overYears", { years: HORIZON_YEARS })}
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
              {t("fundCost.cheapestPrefix")}{" "}
              <span className="text-foreground">{summary.cheapest.name}</span>{" "}
              {t("fundCost.cheapestAt", {
                charge: formatCharge(summary.cheapest.ongoingCharge),
              })}{" "}
              <span className="tabular-nums">
                {formatEuro(summary.coveredValue)}
              </span>{" "}
              {t("fundCost.wouldCost")}{" "}
              <span className="tabular-nums text-foreground">
                {formatEuro(summary.costAtCheapest ?? 0)}
              </span>{" "}
              {t("fundCost.differenceOf")}{" "}
              <span className="font-medium tabular-nums text-foreground">
                {formatEuro(saving)}
              </span>{" "}
              {t("fundCost.aYear")}
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
          {t("fundCost.missingCharge", { count: summary.missingCount })}
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
          {t("fundCost.partialSuffix")}
        </p>
      ) : null}
    </Card.Bezel>
  );
}

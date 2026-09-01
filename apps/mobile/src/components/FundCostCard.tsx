import { useMemo } from "react";
import { View } from "react-native";

import {
  buildFundCosts,
  costOverYears,
  formatCharge,
  savingAtCheapest,
} from "@finance/core/fund-costs";
import type { InvestmentPortfolioSummary } from "@finance/core/investment-positions";

import { Card } from "@/components/ui/Card";
import { PrivateAmount } from "@/components/PrivateAmount";
import { Text } from "@/components/ui/Text";
import { useFormatCurrency } from "@/providers/CurrencyProvider";

/** Long enough to make the drag visible, short enough to stay believable. */
const HORIZON_YEARS = 10;

interface FundCostCardProps {
  portfolio: InvestmentPortfolioSummary;
}

/**
 * What the portfolio costs to hold.
 *
 * Fund charges are the largest controllable cost in a long-term portfolio and
 * the only one that never appears anywhere — they come out of the fund's value
 * continuously. 0.38% sounds like nothing; €76 a year does not.
 *
 * Any comparison is against the cheapest fund the user already holds, so the
 * app never asserts what a fair charge is.
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

  const priced = summary.rows.filter((row) => row.ongoingCharge !== null);
  const saving = savingAtCheapest(summary);

  return (
    <Card bezel innerClassName="gap-2 p-4">
      <View className="flex-row flex-wrap items-baseline justify-between gap-2">
        <Text className="font-bold">What holding this costs</Text>
        {summary.weightedAverage !== null ? (
          <Text variant="muted" className="text-xs">
            {`${formatCharge(summary.weightedAverage)} a year, weighted`}
          </Text>
        ) : null}
      </View>

      {priced.length === 0 ? (
        <Text variant="muted" className="text-sm">
          Add each holding&apos;s ongoing charge — the yearly fee on its KID —
          and this becomes a figure in euros. It is the biggest cost most
          portfolios have and the only one that never shows up on a statement.
        </Text>
      ) : (
        <>
          <PrivateAmount
            className="font-mono font-bold"
            style={{ fontSize: 26 }}
          >
            {formatEuro(summary.totalAnnualCost)}
          </PrivateAmount>
          <Text variant="muted" className="text-sm">
            {`a year on ${formatEuro(summary.coveredValue)} · ${formatEuro(
              costOverYears(summary.totalAnnualCost, HORIZON_YEARS),
            )} over ${HORIZON_YEARS} years at this balance`}
          </Text>

          <View className="mt-1 border-t border-border">
            {priced.map((row) => (
              <View
                key={row.positionId}
                className="flex-row items-baseline justify-between gap-3 border-b border-border py-2"
              >
                <Text numberOfLines={1} className="flex-1 text-sm">
                  {row.name}
                </Text>
                <Text variant="muted" className="font-mono text-xs">
                  {formatCharge(row.ongoingCharge)}
                </Text>
                <PrivateAmount className="w-20 text-right font-mono text-sm">
                  {formatEuro(row.annualCost ?? 0)}
                </PrivateAmount>
              </View>
            ))}
          </View>

          {saving !== null && summary.cheapest ? (
            <Text variant="muted" className="mt-1 text-sm">
              {`Your cheapest holding is ${summary.cheapest.name} at ${formatCharge(
                summary.cheapest.ongoingCharge,
              )}. At that rate the same ${formatEuro(
                summary.coveredValue,
              )} would cost ${formatEuro(summary.costAtCheapest ?? 0)} — a difference of `}
              <Text className="font-medium text-foreground">
                {`${formatEuro(saving)} a year.`}
              </Text>
            </Text>
          ) : null}
        </>
      )}

      {summary.missingCount > 0 ? (
        <Text variant="muted" className="mt-1 border-t border-border pt-2 text-xs">
          {`${summary.missingCount} ${
            summary.missingCount === 1 ? "holding has" : "holdings have"
          } no charge recorded${
            summary.uncoveredValue > 0
              ? ` (${formatEuro(summary.uncoveredValue)})`
              : ""
          }, so this total is partial.`}
        </Text>
      ) : null}
    </Card>
  );
}

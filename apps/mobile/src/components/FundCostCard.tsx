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
import { useT } from "@/providers/LocaleProvider";

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
  const t = useT();

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
    <Card bezel innerClassName="gap-2 p-5">
      <View className="flex-row flex-wrap items-baseline justify-between gap-2">
        <Text className="font-bold">{t("fundCost.title")}</Text>
        {summary.weightedAverage !== null ? (
          <Text variant="muted" className="text-xs">
            {`${formatCharge(summary.weightedAverage)} ${t(
              "fundCost.weightedSuffix",
            )}`}
          </Text>
        ) : null}
      </View>

      {priced.length === 0 ? (
        <Text variant="muted" className="text-sm">
          {t("fundCost.emptyBody")}
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
            {`${t("fundCost.aYearOn")} ${formatEuro(summary.coveredValue)} · ${formatEuro(
              costOverYears(summary.totalAnnualCost, HORIZON_YEARS),
            )} ${t("fundCost.overYears", { years: HORIZON_YEARS })}`}
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
              {`${t("fundCost.cheapestPrefix")} ${summary.cheapest.name} ${t(
                "fundCost.cheapestAt",
                { charge: formatCharge(summary.cheapest.ongoingCharge) },
              )} ${formatEuro(summary.coveredValue)} ${t(
                "fundCost.wouldCost",
              )} ${formatEuro(summary.costAtCheapest ?? 0)} ${t(
                "fundCost.differenceOf",
              )} `}
              <Text className="font-medium text-foreground">
                {`${formatEuro(saving)} ${t("fundCost.aYear")}`}
              </Text>
            </Text>
          ) : null}
        </>
      )}

      {summary.missingCount > 0 ? (
        <Text
          variant="muted"
          className="mt-1 border-t border-border pt-2 text-xs"
        >
          {`${t("fundCost.missingCharge", { count: summary.missingCount })}${
            summary.uncoveredValue > 0
              ? ` (${formatEuro(summary.uncoveredValue)})`
              : ""
          }${t("fundCost.partialSuffix")}`}
        </Text>
      ) : null}
    </Card>
  );
}

import { useMemo } from "react";
import { View } from "react-native";

import { formatSigned } from "@finance/core/amount-sign";
import { ENVELOPE_SHORT_KEYS } from "@finance/core/future-plan";
import {
  summariseEvents,
  type InvestmentEvent,
} from "@finance/core/investment-events";

import { PrivateAmount } from "@/components/PrivateAmount";
import { Card } from "@/components/ui/Card";
import { Text } from "@/components/ui/Text";
import { cn } from "@/lib/cn";
import { useFormatCurrency } from "@/providers/CurrencyProvider";
import { useT } from "@/providers/LocaleProvider";

/**
 * « Dividendes et plus-values réalisées » — the web's card: what the
 * wallets' operations add up to, by year and wrapper. Each sale against
 * the oldest purchases of the same line still held (first in, first out,
 * as the tax office reads a PEA or a CTO), the dividends received, the
 * fees taken; a sale whose purchases are not all recorded says so.
 */
export function EventsCard({ events }: { events: InvestmentEvent[] }) {
  const t = useT();
  const formatEuro = useFormatCurrency();
  const summary = useMemo(() => summariseEvents(events), [events]);

  return (
    <Card bezel innerClassName="gap-3 p-5">
      <View className="gap-1">
        <Text className="font-bold">{t("events.cardTitle")}</Text>
        <Text variant="muted" className="text-xs">
          {summary.years.length === 0
            ? t("events.cardEmpty")
            : t("events.cardBody")}
        </Text>
      </View>

      {summary.years.map((year) => {
        const gains = summary.gains.filter((row) => row.year === year);
        const dividends = summary.dividends.filter((row) => row.year === year);
        const fees = summary.fees.filter((row) => row.year === year);
        const uncovered = gains.reduce((sum, row) => sum + row.uncoveredSells, 0);
        return (
          <View key={year} className="gap-2 border-t border-border pt-3">
            <Text className="text-sm font-medium">{String(year)}</Text>
            {gains.map((row) => (
              <View key={`gain-${row.wallet}`} className="gap-0.5">
                <View className="flex-row items-baseline justify-between gap-3">
                  <Text variant="muted" className="text-sm">
                    {t("events.gains")} · {t(ENVELOPE_SHORT_KEYS[row.wallet])}
                  </Text>
                  <PrivateAmount
                    className={cn(
                      "text-sm",
                      row.gain > 0
                        ? "text-success"
                        : row.gain < 0
                          ? "text-destructive"
                          : "text-foreground",
                    )}
                  >
                    {formatSigned(row.gain, formatEuro)}
                  </PrivateAmount>
                </View>
                <Text variant="muted" className="text-xs">
                  {t("events.proceeds")} {formatEuro(row.proceeds)} ·{" "}
                  {t("events.basis")} {formatEuro(row.basis)}
                </Text>
              </View>
            ))}
            {dividends.map((row) => (
              <View
                key={`dividend-${row.wallet}`}
                className="flex-row items-baseline justify-between gap-3"
              >
                <Text variant="muted" className="text-sm">
                  {t("events.dividends")} · {t(ENVELOPE_SHORT_KEYS[row.wallet])}
                </Text>
                <PrivateAmount className="text-sm text-success">
                  {formatSigned(row.amount, formatEuro)}
                </PrivateAmount>
              </View>
            ))}
            {fees.map((row) => (
              <View
                key={`fee-${row.wallet}`}
                className="flex-row items-baseline justify-between gap-3"
              >
                <Text variant="muted" className="text-sm">
                  {t("events.fees")} · {t(ENVELOPE_SHORT_KEYS[row.wallet])}
                </Text>
                <PrivateAmount className="text-sm text-destructive">
                  {formatSigned(-row.amount, formatEuro)}
                </PrivateAmount>
              </View>
            ))}
            {uncovered > 0 ? (
              <Text variant="muted" className="text-xs">
                {t("events.uncovered", { count: uncovered })}
              </Text>
            ) : null}
          </View>
        );
      })}
    </Card>
  );
}

import { useState } from "react";
import { View } from "react-native";

import { formatSignedPercentOf } from "@finance/core/constants";
import { quarterLabel } from "@finance/core/property";
import type { PriceHistory } from "@finance/core/property-history";

import { HistoryLine } from "@/components/charts/HistoryLine";
import { PrivateAmount } from "@/components/PrivateAmount";
import { Card } from "@/components/ui/Card";
import { Text } from "@/components/ui/Text";
import { useFormatCurrency } from "@/providers/CurrencyProvider";
import { useLocale, useT } from "@/providers/LocaleProvider";
import { usePrivacy } from "@/providers/PrivacyProvider";
import { TYPE } from "@/theme/tokens";

/**
 * A property's price history — the web's `PriceHistoryCard`, from the same
 * core reading: what its area's prices have done to its purchase price,
 * quarter by quarter. One figure, the move since the purchase, over the line
 * that makes it, then what was paid, what that is at today's prices, and the
 * estimated value when it comes from somewhere else.
 *
 * The figure is not coloured: it is a fact about the area, not a result.
 */
export function PriceHistoryCard({ history }: { history: PriceHistory }) {
  const t = useT();
  const locale = useLocale();
  const format = useFormatCurrency();
  const { hidden } = usePrivacy();
  const [active, setActive] = useState<number | null>(null);
  const first = history.points[0]!;
  const last = history.points.at(-1)!;
  const read = active === null ? last : (history.points[active] ?? last);
  const change = formatSignedPercentOf(history.change, locale);

  return (
    <Card bezel innerClassName="gap-4">
      <Text className="font-semibold" style={{ fontSize: 17 }}>
        {t("property.historyTitle")}
      </Text>

      <View className="flex-row items-end justify-between gap-3">
        <View className="min-w-0 flex-1 gap-0.5">
          <Text variant="muted" className="text-xs">
            {t("property.historySince", { quarter: quarterLabel(first.quarter, locale) })}
          </Text>
          <Text variant="figure" style={TYPE.figure}>
            {change}
          </Text>
        </View>
        {/* What the finger is on; today's point while it is nowhere. */}
        <View className="items-end gap-0.5" accessibilityLiveRegion="polite">
          <Text variant="muted" className="text-xs">
            {quarterLabel(read.quarter, locale)}
          </Text>
          <PrivateAmount className="text-sm font-medium">{format(read.value)}</PrivateAmount>
        </View>
      </View>

      <View>
        <HistoryLine
          values={history.points.map((point) => point.value)}
          mark={history.estimate?.value ?? null}
          active={active}
          onActive={setActive}
          label={`${t("property.historyChartLabel")} · ${t("property.historySince", {
            quarter: quarterLabel(first.quarter, locale),
          })} ${change}`}
          format={(value) => (hidden ? "••••" : format(value))}
        />
        <View className="mt-1 flex-row justify-between" style={{ paddingLeft: 62, paddingRight: 7 }}>
          <Text variant="micro">{quarterLabel(first.quarter, locale)}</Text>
          <Text variant="micro">{quarterLabel(last.quarter, locale)}</Text>
        </View>
      </View>

      <View className="flex-row flex-wrap gap-y-3 border-t border-border pt-4">
        <Figure label={t("property.historyPaid")} value={format(history.paid)} />
        <Figure
          label={t("property.historyCarried", { quarter: quarterLabel(last.quarter, locale) })}
          value={format(history.carried)}
          swatch="line"
        />
        {history.estimate ? (
          <Figure
            label={
              history.estimate.kind === "market"
                ? t("property.historyEstimateMarket")
                : t("property.historyEstimateOwn")
            }
            value={format(history.estimate.value)}
            swatch="mark"
          />
        ) : null}
        {history.peak ? (
          <Figure
            label={`${t("property.historyPeak")} · ${quarterLabel(history.peak.quarter, locale)}`}
            value={format(history.peak.value)}
          />
        ) : null}
      </View>

      <Text variant="muted" className="text-xs">
        {history.startsLate
          ? `${t("property.historyStartsLate", { quarter: quarterLabel(first.quarter, locale) })} `
          : ""}
        {t("property.historyLead")} {t("property.historyNote")}
      </Text>
    </Card>
  );
}

/** One amount under the chart, with the mark that draws it when it has one. */
function Figure({
  label,
  value,
  swatch,
}: {
  label: string;
  value: string;
  swatch?: "line" | "mark";
}) {
  return (
    <View className="w-1/2 min-w-0 gap-0.5 pr-3">
      <View className="flex-row items-center gap-1.5">
        {swatch === "line" ? (
          <View className="h-0.5 w-3 rounded-full bg-primary" />
        ) : swatch === "mark" ? (
          <View className="h-2.5 w-2.5 rounded-full border-2 border-primary" />
        ) : null}
        <Text variant="muted" className="min-w-0 flex-1 text-xs">
          {label}
        </Text>
      </View>
      <PrivateAmount className="text-sm font-medium">{value}</PrivateAmount>
    </View>
  );
}

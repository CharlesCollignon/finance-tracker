import { useState } from "react";
import { Pressable, View } from "react-native";

import { formatDayMonth } from "@finance/core/constants";
import type { LeftToSpend } from "@finance/core/left-to-spend";

import { AnimatedAmount } from "@/components/AnimatedAmount";
import { PrivateAmount } from "@/components/PrivateAmount";
import { Text } from "@/components/ui/Text";
import { useFormatCurrency } from "@/providers/CurrencyProvider";
import { useLocale, useT } from "@/providers/LocaleProvider";
import { TYPE } from "@/theme/tokens";

/**
 * « Il vous reste », as on the web: what the account can still give before
 * the next pay day, with the charges due by then and the marge already taken
 * off (`@finance/core/left-to-spend`).
 *
 * Below zero it says what is missing, in the ordinary colour: the overdraft
 * warning is the alarm, and this is the arithmetic behind it.
 */
export function LeftToSpendCard({ left }: { left: LeftToSpend }) {
  const t = useT();
  const locale = useLocale();
  const format = useFormatCurrency();
  const [howOpen, setHowOpen] = useState(false);
  const short = left.amount < 0;
  const until = left.payDay
    ? t(short ? "leftToSpend.byPayDay" : "leftToSpend.untilPayDay", {
        date: formatDayMonth(left.payDay, locale),
      })
    : t(short ? "leftToSpend.byMonthEnd" : "leftToSpend.untilMonthEnd");

  return (
    <View className="gap-1.5 rounded-card border border-border bg-card/70 p-card">
      <Text className="text-sm font-medium text-muted-foreground">
        {t(short ? "leftToSpend.missing" : "leftToSpend.title")}
      </Text>
      <AnimatedAmount
        value={Math.abs(left.amount)}
        format={format}
        style={TYPE.hero}
        numberOfLines={1}
        adjustsFontSizeToFit
      />
      <Text variant="muted" className="text-sm">
        {until}
      </Text>
      {left.perDay !== null ? (
        <PrivateAmount className="text-sm text-muted-foreground">
          {t("leftToSpend.perDay", { amount: format(left.perDay) })}
        </PrivateAmount>
      ) : null}
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: howOpen }}
        hitSlop={8}
        onPress={() => setHowOpen((open) => !open)}
        className="self-start"
      >
        <Text variant="muted" className="text-xs underline">
          {t("leftToSpend.how.title")}
        </Text>
      </Pressable>
      {howOpen ? (
        <View className="gap-1.5">
          <Text variant="muted" className="text-xs leading-relaxed">
            {t("leftToSpend.how.body")}
          </Text>
          <Text variant="muted" className="text-xs leading-relaxed">
            {t(left.payDay ? "leftToSpend.how.payDay" : "leftToSpend.how.monthEnd")}
          </Text>
          {left.marge > 0 ? (
            <PrivateAmount className="text-xs leading-relaxed text-muted-foreground">
              {t("leftToSpend.how.marge", {
                count: left.days,
                amount: format(left.marge),
              })}
            </PrivateAmount>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

import { View } from "react-native";
import { CategoryIcon } from "@/components/CategoryIcon";
import { PrivateAmount } from "@/components/PrivateAmount";
import { MyShareToggle } from "@/components/bearing/MyShareToggle";
import { Text } from "@/components/ui/Text";
import type { HomeMonth } from "@/lib/home-data";
import { useFormatCurrency } from "@/providers/CurrencyProvider";
import { useT } from "@/providers/LocaleProvider";
import { useThemeColors } from "@/theme/useThemeColors";
import { GrowBar, HomeCard } from "@/components/bearing/card-parts";

export function WhereItWentCard({ data }: { data: HomeMonth }) {
  const t = useT();
  const format = useFormatCurrency();
  const colors = useThemeColors();
  const { spending } = data;
  const peak = Math.max(1, ...spending.top.map((entry) => entry.total));

  return (
    <HomeCard
      icon="pie-chart-outline"
      title={t("bearingMonth.whereItWent")}
      // The Ledger's by-category view, as on the web: where each of these
      // categories has been going, not this month's rows.
      href="/history"
      hrefLabel={t("bearingMonth.seeInLedger")}
      action={data.myShare ? <MyShareToggle /> : null}
    >
      <View className="gap-4">
        {spending.top.map((entry) => {
          // Against the month's largest, so the bars rank the categories.
          const ratio = entry.total / peak;
          return (
            <View
              key={entry.categoryId}
              className="flex-row items-center gap-3"
            >
              <CategoryIcon icon={entry.icon} />
              <View className="min-w-0 flex-1 gap-2">
                <View className="flex-row items-baseline justify-between gap-3">
                  <Text
                    numberOfLines={1}
                    className="shrink text-sm font-medium"
                  >
                    {entry.name}
                  </Text>
                  <PrivateAmount className="text-sm">
                    {format(entry.total)}
                  </PrivateAmount>
                </View>
                <GrowBar ratio={ratio} color={colors.mutedForeground} />
              </View>
            </View>
          );
        })}
      </View>
      {spending.rest > 0 ? (
        <View className="flex-row items-center justify-between gap-3">
          <Text variant="muted" className="text-sm">
            {t("bearingMonth.everythingElse")}
          </Text>
          <PrivateAmount className="text-sm text-muted-foreground">
            {format(spending.rest)}
          </PrivateAmount>
        </View>
      ) : null}
    </HomeCard>
  );
}

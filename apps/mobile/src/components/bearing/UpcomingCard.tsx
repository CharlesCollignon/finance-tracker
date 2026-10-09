import { View } from "react-native";
import { amountSign } from "@finance/core/amount-sign";
import { TYPE_AMOUNT_CLASS } from "@finance/core/category-styles";
import { formatShortDate } from "@finance/core/constants";
import { monthShort } from "@finance/core/i18n/calendar-names";
import { PrivateAmount } from "@/components/PrivateAmount";
import { Text } from "@/components/ui/Text";
import { cn } from "@/lib/cn";
import type { HomeMonth } from "@/lib/home-data";
import { useFormatCurrency } from "@/providers/CurrencyProvider";
import { useLocale, useT } from "@/providers/LocaleProvider";
import { HomeCard } from "@/components/bearing/card-parts";

/** How many recurring entries still to come the card lists before "+N more". */
const UPCOMING_SHOWN = 4;

/* ------------------------------------------------------------ what comes */

export function UpcomingCard({ data }: { data: HomeMonth }) {
  const t = useT();
  const locale = useLocale();
  const format = useFormatCurrency();
  const upcoming = data.upcoming!;
  const shown = upcoming.charges.slice(0, UPCOMING_SHOWN);
  const more = upcoming.charges.length - shown.length;

  return (
    <HomeCard
      icon="calendar-outline"
      title={
        data.balance.period === "future"
          ? t("bearingMonth.plannedThisMonth")
          : t("bearingMonth.stillToCome")
      }
      href="/transactions"
      hrefLabel={t("bearingMonth.seeInLedger")}
    >
      {shown.length === 0 ? (
        <Text variant="muted" className="text-sm">
          {t("bearingMonth.nothingToCome")}
        </Text>
      ) : (
        <View className="gap-3">
          {shown.map((charge) => (
            <View key={charge.key} className="flex-row items-center gap-3">
              <View
                accessible
                accessibilityLabel={formatShortDate(charge.occurredOn, locale)}
                className="h-10 w-10 items-center justify-center rounded-control border border-hairline-strong"
              >
                <Text
                  className={cn(
                    "text-sm font-semibold tabular-nums",
                    charge.awaited && "text-muted-foreground",
                  )}
                >
                  {String(Number(charge.occurredOn.slice(8, 10)))}
                </Text>
                <Text className="text-[10px] uppercase text-muted-foreground">
                  {monthShort(Number(charge.occurredOn.slice(5, 7)), locale)}
                </Text>
              </View>
              <View className="min-w-0 flex-1">
                <Text numberOfLines={1} className="text-sm">
                  {charge.description?.trim() || charge.name}
                </Text>
                {/* Its day is behind it and the bank has not brought it: it
                    is still to leave, but not coming up, and the date alone
                    would read as the card having fallen behind. */}
                {charge.awaited ? (
                  <Text variant="muted" numberOfLines={1} className="text-xs">
                    {t("ledger.awaited")}
                  </Text>
                ) : null}
              </View>
              <PrivateAmount
                className={cn("text-sm", TYPE_AMOUNT_CLASS[charge.type])}
              >
                {`${amountSign(charge.type)}${format(charge.amount)}`}
              </PrivateAmount>
            </View>
          ))}
        </View>
      )}
      {more > 0 ? (
        <Text variant="muted" className="text-xs">
          {t("bearingMonth.moreToCome", { count: more })}
        </Text>
      ) : null}
    </HomeCard>
  );
}

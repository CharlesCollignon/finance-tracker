import { View } from "react-native";

import {
  spaceBalanceIsEmpty,
  type SpaceBalance,
} from "@finance/core/space-balance";

import { HomeCard } from "@/components/bearing/card-parts";
import { PrivateAmount } from "@/components/PrivateAmount";
import { Text } from "@/components/ui/Text";
import { cn } from "@/lib/cn";
import { useFormatCurrency } from "@/providers/CurrencyProvider";
import { useT } from "@/providers/LocaleProvider";

/* ------------------------------------------------- the balance between two */

/**
 * « Équilibre », under « Commun »: what each partner put into the joint
 * account this month, against their part of what the space spent, and the
 * one line it adds up to — the web's card.
 */
export function BalanceBetweenCard({ balance }: { balance: SpaceBalance }) {
  const t = useT();
  const format = useFormatCurrency();

  return (
    <HomeCard icon="scale-outline" title={t("space.balanceTitle")}>
      {spaceBalanceIsEmpty(balance) ? (
        <Text variant="muted" className="text-sm">
          {t("space.balanceNothing")}
        </Text>
      ) : (
        <>
          {balance.settle ? (
            <PrivateAmount className="text-sm font-medium">
              {t("space.balanceSettle", {
                name: balance.settle.name,
                amount: format(balance.settle.amount),
              })}
            </PrivateAmount>
          ) : (
            <Text className="text-sm font-medium">{t("space.balanceEven")}</Text>
          )}
          <View className="gap-1.5">
            {balance.members.map((line) => (
              <View
                key={line.userId}
                className="flex-row items-baseline justify-between gap-3"
              >
                <PrivateAmount className="min-w-0 flex-1 text-sm">
                  {t("space.balancePut", {
                    name: line.name,
                    amount: format(line.put),
                  })}
                </PrivateAmount>
                <PrivateAmount
                  className={cn(
                    "text-sm",
                    line.diff >= 0 ? "text-muted-foreground" : "text-warning",
                  )}
                >
                  {t("space.balancePart", { amount: format(line.part) })}
                </PrivateAmount>
              </View>
            ))}
          </View>
          <Text variant="micro">
            <PrivateAmount className="text-xs text-muted-foreground">
              {t("space.balanceSpent", { amount: format(balance.spent) })}
            </PrivateAmount>
            {` · ${t("space.balanceHint")}`}
          </Text>
        </>
      )}
    </HomeCard>
  );
}

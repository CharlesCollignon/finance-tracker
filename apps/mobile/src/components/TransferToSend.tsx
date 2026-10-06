import { Pressable, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { amountSign } from "@finance/core/amount-sign";
import { TYPE_AMOUNT_CLASS } from "@finance/core/category-styles";
import { formatShortDate } from "@finance/core/constants";
import {
  describeDcaNeed,
  type TransferReminder,
} from "@finance/core/dca-need";

import { PrivateAmount } from "@/components/PrivateAmount";
import { Text } from "@/components/ui/Text";
import { cn } from "@/lib/cn";
import { hapticLight } from "@/lib/haptics";
import { useFormatCurrency } from "@/providers/CurrencyProvider";
import { useLocale, useT } from "@/providers/LocaleProvider";
import { useThemeColors } from "@/theme/useThemeColors";
import { ICON } from "@/theme/tokens";

/**
 * « À envoyer au courtier » — the web twin carries the reasoning: from three
 * days before payday until it is sent, how much the transfer that follows
 * the DCAs should be, leading to its charge.
 */
export function TransferToSend({ transfer }: { transfer: TransferReminder }) {
  const t = useT();
  const locale = useLocale();
  const router = useRouter();
  const colors = useThemeColors();
  const formatEuro = useFormatCurrency();

  return (
    <View accessibilityLabel={t("dcaTransfer.title")}>
      <View className="border-b border-border px-4 py-2">
        <Text className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {t("dcaTransfer.title")}
        </Text>
      </View>

      <View className="gap-1 px-4 py-3">
        <View className="flex-row flex-wrap items-baseline gap-x-2">
          <Text className="text-sm font-medium">{transfer.label}</Text>
          <PrivateAmount
            className={cn("text-sm", TYPE_AMOUNT_CLASS.investment)}
          >
            {`${amountSign("investment")}${formatEuro(transfer.need.amount)}`}
          </PrivateAmount>
        </View>
        <PrivateAmount className="text-xs text-muted-foreground">
          {describeDcaNeed(transfer.need, t, locale)}
        </PrivateAmount>
        <Text className="text-xs text-muted-foreground">
          {t("dcaTransfer.due", {
            date: formatShortDate(transfer.occurredOn, locale),
          })}
        </Text>

        <Pressable
          accessibilityRole="link"
          onPress={() => {
            void hapticLight();
            router.push("/recurring");
          }}
          className="mt-1 min-h-11 flex-row items-center gap-1.5 self-start rounded-full"
        >
          <Text className="text-sm text-muted-foreground">
            {t("dcaTransfer.open")}
          </Text>
          <Ionicons
            name="arrow-forward"
            size={ICON.md}
            color={colors.mutedForeground}
          />
        </Pressable>
      </View>
    </View>
  );
}

import { View } from "react-native";
import { useRouter, type Href } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { Button } from "@/components/ui/Button";
import { Text } from "@/components/ui/Text";
import { useT } from "@/providers/LocaleProvider";
import { ICON } from "@/theme/tokens";
import { useThemeColors } from "@/theme/useThemeColors";

/**
 * Accounts the bank shows that nobody has said anything about yet — a bank
 * just added on open-banking.io, as a rule — said on Le point and answered
 * on the Bank screen: the web's line. Nothing of theirs reaches the ledger
 * or the balance until then, which is why it is said at all.
 */
export function NewAccountsLine({ count }: { count: number }) {
  const t = useT();
  const router = useRouter();
  const colors = useThemeColors();
  return (
    <View
      accessibilityRole="summary"
      className="gap-3 rounded-control border bg-primary/5 px-4 py-3"
      style={{ borderColor: colors.primaryRim }}
    >
      <View className="flex-row items-start gap-2.5">
        <Ionicons
          name="business-outline"
          size={ICON.lg}
          color={colors.primaryInk}
        />
        <Text className="min-w-0 flex-1 text-sm font-medium">
          {t("bankAccounts.bearingLine", { count })}
        </Text>
      </View>
      <Button
        label={t("bankAccounts.bearingCta", { count })}
        size="sm"
        className="self-end"
        onPress={() => router.push("/bank" as Href)}
      />
    </View>
  );
}

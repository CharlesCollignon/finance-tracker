import { useState } from "react";
import { Pressable, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import type { Key } from "@finance/core/i18n/t";

import { ConnectBankSheet } from "@/components/bank/ConnectBankSheet";
import { Button } from "@/components/ui/Button";
import { Text } from "@/components/ui/Text";
import type { BankState } from "@/hooks/useBankState";
import {
  dismissBankInvite,
  shouldInvite,
  type BankInviteSurface,
} from "@/lib/bank-connect";
import { cn } from "@/lib/cn";
import { hapticLight } from "@/lib/haptics";
import { useAuth } from "@/providers/AuthProvider";
import { useLocale, useT } from "@/providers/LocaleProvider";
import { ICON } from "@/theme/tokens";
import { useThemeColors } from "@/theme/useThemeColors";

/** What each surface promises, in its own words. */
const PROMISE: Record<BankInviteSurface, Key> = {
  bearing: "bankConnect.inviteBearing",
  welcome: "bankConnect.inviteWelcome",
  ledger: "bankConnect.inviteLedger",
  plan: "bankConnect.invitePlan",
};

/**
 * An invitation to connect a bank, the web's on the phone.
 *
 * Draws itself only where the web's rule would (`shouldInvite`), from the
 * state its screen already read, and says what connecting changes *there*
 * with the price in the same breath. Dismissed for good on its surface, and
 * on every device: the dismissal is stored on the user, not the phone.
 */
export function ConnectBankInvite({
  surface,
  bank,
  className,
}: {
  surface: BankInviteSurface;
  bank: BankState | null;
  className?: string;
}) {
  const t = useT();
  const locale = useLocale();
  const colors = useThemeColors();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [gone, setGone] = useState(false);

  if (gone || !bank || !shouldInvite(surface, bank)) {
    return null;
  }

  function dismiss() {
    if (!user) {
      return;
    }
    void hapticLight();
    setGone(true);
    void dismissBankInvite(user.id, surface, locale);
  }

  return (
    <>
      <View
        className={cn(
          "flex-row flex-wrap items-center gap-3 rounded-control border bg-primary/5 px-4 py-3",
          className,
        )}
        style={{ borderColor: colors.primaryRim }}
      >
        <View className="h-8 w-8 items-center justify-center rounded-full bg-primary">
          <Ionicons
            name="business-outline"
            size={ICON.md}
            color={colors.primaryForeground}
          />
        </View>
        <View className="min-w-0 flex-1 gap-0.5" style={{ flexBasis: 180 }}>
          <Text className="text-sm font-medium">{t(PROMISE[surface])}</Text>
          <Text variant="muted" className="text-xs">
            {t("bankConnect.priceNote")}
          </Text>
        </View>
        <View className="flex-row items-center gap-1">
          <Button
            label={t("bankConnect.sheetTitle")}
            size="sm"
            onPress={() => setOpen(true)}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("bankConnect.dismissInvite")}
            onPress={dismiss}
            className="h-11 w-11 items-center justify-center rounded-full"
          >
            <Ionicons
              name="close"
              size={ICON.md}
              color={colors.mutedForeground}
            />
          </Pressable>
        </View>
      </View>
      <ConnectBankSheet open={open} onOpenChange={setOpen} />
    </>
  );
}

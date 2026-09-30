import { useState } from "react";
import { Linking, Pressable, View } from "react-native";
import { useRouter, type Href } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import type { BankAttention } from "@finance/core/bank-attention";
import { formatShortDate } from "@finance/core/constants";

import { ConnectBankSheet } from "@/components/bank/ConnectBankSheet";
import { Button } from "@/components/ui/Button";
import { Text } from "@/components/ui/Text";
import { OPEN_BANKING_APP } from "@/lib/bank-connect";
import { cn } from "@/lib/cn";
import { useLocale, useT } from "@/providers/LocaleProvider";
import { ICON } from "@/theme/tokens";
import { useThemeColors } from "@/theme/useThemeColors";

/**
 * A connected bank that is about to stop, or has — the web's banner, and the
 * in-app half of the renewal reminder whose other half is the push.
 *
 * Above the figures, because a feed that has stopped leaves every one of
 * them quietly stale, and carrying its own fix. A consent is renewed, and a
 * wallet topped up, in the user's own open-banking.io account, so those two
 * go straight there; a file that no longer works is replaced right here.
 */
export function BankAttentionBanner({
  attention,
  className,
}: {
  attention: BankAttention;
  className?: string;
}) {
  const t = useT();
  const locale = useLocale();
  const colors = useThemeColors();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const renewing = attention.kind === "renew";
  const message =
    attention.kind === "renew"
      ? attention.daysLeft >= 0
        ? t("bankConnect.consentSoon", {
            date: formatShortDate(attention.validUntil, locale),
          })
        : t("bankConnect.consentEnded")
      : attention.kind === "expired"
        ? t("bankConnect.expiredTitle")
        : t("bankConnect.pausedBody");

  return (
    <>
      <View
        accessibilityRole="summary"
        className={cn(
          "gap-3 rounded-control border px-4 py-3",
          renewing ? "bg-primary/5" : "bg-warning/10",
          className,
        )}
        style={{
          borderColor: renewing ? colors.primaryRim : colors.warning,
        }}
      >
        <View className="flex-row items-start gap-2.5">
          <Ionicons
            name={renewing ? "sync-outline" : "alert-circle"}
            size={ICON.lg}
            color={renewing ? colors.primaryInk : colors.warning}
          />
          <Text className="min-w-0 flex-1 text-sm font-medium">{message}</Text>
        </View>
        <View className="flex-row items-center justify-end gap-1">
          <Pressable
            accessibilityRole="link"
            onPress={() => router.push("/bank" as Href)}
            className="min-h-11 justify-center px-3"
          >
            <Text variant="muted" className="text-sm">
              {t("bankConnect.details")}
            </Text>
          </Pressable>
          {attention.kind === "expired" ? (
            <Button
              label={t("bankConnect.reconnect")}
              size="sm"
              onPress={() => setOpen(true)}
            />
          ) : (
            <Button
              label={
                renewing ? t("bankConnect.renew") : t("bankConnect.openSite")
              }
              size="sm"
              onPress={() => void Linking.openURL(OPEN_BANKING_APP)}
            />
          )}
        </View>
      </View>
      {attention.kind === "expired" ? (
        <ConnectBankSheet open={open} onOpenChange={setOpen} />
      ) : null}
    </>
  );
}

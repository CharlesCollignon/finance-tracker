import { Pressable, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { formatShortDate } from "@finance/core/constants";
import type { TrustSignal } from "@finance/core/month-trust";

import { attentionHref } from "@/components/bearing/TodoStrip";
import { HomeCard } from "@/components/bearing/card-parts";
import { PrivateAmount } from "@/components/PrivateAmount";
import { Text } from "@/components/ui/Text";
import { cn } from "@/lib/cn";
import { hapticLight } from "@/lib/haptics";
import { useFormatCurrency } from "@/providers/CurrencyProvider";
import { useLocale, useT } from "@/providers/LocaleProvider";
import { ICON } from "@/theme/tokens";
import { useThemeColors } from "@/theme/useThemeColors";

/* ----------------------------------------------------- what backs the month */

/**
 * « Fiabilité du mois »: what the month's figures rest on, one fact a line
 * — how far the bank's or a statement's lines reach, the charges arrived
 * and awaited, what waits in the review, and the close and what it found.
 * Each line is a measurement from `@finance/core/month-trust`; a line with
 * somewhere to go opens it. The web draws the same card.
 */
export function TrustCard({ signals }: { signals: TrustSignal[] }) {
  const t = useT();
  const locale = useLocale();
  const format = useFormatCurrency();
  const router = useRouter();
  const colors = useThemeColors();

  return (
    <HomeCard icon="shield-checkmark-outline" title={t("bearingMonth.trust.title")}>
      <View className="gap-1">
        {signals.map((signal) => {
          const text = t(signal.messageKey, {
            ...signal.params,
            ...(signal.amount !== undefined
              ? { amount: format(signal.amount) }
              : {}),
            ...(signal.date
              ? { date: formatShortDate(signal.date, locale) }
              : {}),
          });
          const row = (
            <View className="min-h-8 flex-row items-center gap-2.5">
              <ToneIcon tone={signal.tone} />
              {signal.amount !== undefined ? (
                <PrivateAmount className="flex-1 text-sm">{text}</PrivateAmount>
              ) : (
                <Text
                  className={cn(
                    "flex-1 text-sm",
                    signal.tone === "none" && "text-muted-foreground",
                  )}
                >
                  {text}
                </Text>
              )}
              {signal.href ? (
                <Ionicons
                  name="chevron-forward"
                  size={ICON.sm}
                  color={colors.mutedForeground}
                />
              ) : null}
            </View>
          );
          return signal.href ? (
            <Pressable
              key={signal.id}
              accessibilityRole="link"
              accessibilityLabel={text}
              hitSlop={4}
              onPress={() => {
                const to = attentionHref(signal.href!);
                if (to) {
                  void hapticLight();
                  router.push(to);
                }
              }}
            >
              {row}
            </Pressable>
          ) : (
            <View key={signal.id} accessible accessibilityLabel={text}>
              {row}
            </View>
          );
        })}
      </View>
    </HomeCard>
  );
}

/** The line's state, by colour and shape; the sentence says it in words. */
function ToneIcon({ tone }: { tone: TrustSignal["tone"] }) {
  const colors = useThemeColors();
  if (tone === "ok") {
    return (
      <Ionicons name="checkmark-circle" size={ICON.md} color={colors.success} />
    );
  }
  if (tone === "waiting") {
    return <Ionicons name="time" size={ICON.md} color={colors.warning} />;
  }
  return (
    <Ionicons
      name="remove-circle-outline"
      size={ICON.md}
      color={colors.mutedForeground}
    />
  );
}

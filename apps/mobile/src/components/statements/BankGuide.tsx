import { useState } from "react";
import { Pressable, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as WebBrowser from "expo-web-browser";
import Animated, {
  FadeIn,
  FadeInDown,
  FadeOut,
  LinearTransition,
  useReducedMotion,
} from "react-native-reanimated";

import { DURATION } from "@finance/core/motion";
import {
  BANK_IDS,
  BANK_NAMES,
  exportGuide,
  type BankId,
} from "@finance/core/statement";

import { Text } from "@/components/ui/Text";
import { cn } from "@/lib/cn";
import { hapticSelection } from "@/lib/haptics";
import { useLocale, useT } from "@/providers/LocaleProvider";
import { ICON } from "@/theme/tokens";
import { useThemeColors } from "@/theme/useThemeColors";

/** The first letters a bank is known by, for its chip. */
function initials(bank: BankId): string {
  return BANK_NAMES[bank]
    .replace(/[^A-Za-zÀ-ÿ0-9 ]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

/**
 * « Où trouver l'export de ma banque ? », on the phone: the person picks
 * their bank and reads where it puts its export — its own steps where they
 * are written down, the steps that hold for any bank otherwise
 * (`exportGuide`) — with its website a tap away. Opens where it stands.
 */
export function BankGuide({ initialBank = null }: { initialBank?: BankId | null }) {
  const t = useT();
  const locale = useLocale();
  const colors = useThemeColors();
  const reduceMotion = useReducedMotion();
  const [open, setOpen] = useState(initialBank !== null);
  const [bank, setBank] = useState<BankId | "other" | null>(initialBank);
  const guide = bank === null ? null : exportGuide(bank === "other" ? null : bank, locale);

  return (
    <Animated.View layout={reduceMotion ? undefined : LinearTransition.duration(DURATION.panel)} className="gap-3">
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        onPress={() => {
          void hapticSelection();
          setOpen((current) => !current);
        }}
        className="min-h-11 flex-row items-center gap-2 self-start"
      >
        <Ionicons name="help-circle-outline" size={ICON.lg} color={colors.foreground} />
        <Text className="text-sm font-medium">{t("statements.where")}</Text>
        <Ionicons
          name={open ? "chevron-up" : "chevron-down"}
          size={ICON.sm}
          color={colors.mutedForeground}
        />
      </Pressable>
      {open ? (
        <Animated.View
          entering={reduceMotion ? undefined : FadeIn.duration(DURATION.panel)}
          exiting={reduceMotion ? undefined : FadeOut.duration(DURATION.press)}
          className="gap-3"
        >
          <Text variant="label">{t("statements.wherePick")}</Text>
          <View accessibilityRole="radiogroup" className="flex-row flex-wrap gap-1.5">
            {[...BANK_IDS, "other" as const].map((id) => {
              const chosen = bank === id;
              return (
                <Pressable
                  key={id}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: chosen }}
                  onPress={() => {
                    void hapticSelection();
                    setBank(id);
                  }}
                  className={cn(
                    "min-h-10 flex-row items-center gap-2 rounded-full border px-3",
                    chosen ? "border-foreground/30 bg-foreground/10" : "border-border",
                  )}
                >
                  {id === "other" ? null : (
                    <View className="h-6 w-6 items-center justify-center rounded-full bg-muted">
                      <Text className="text-[10px] font-semibold">{initials(id)}</Text>
                    </View>
                  )}
                  <Text className={cn("text-sm", !chosen && "text-muted-foreground")}>
                    {id === "other" ? t("statements.otherBank") : BANK_NAMES[id]}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          {guide ? (
            <Animated.View
              key={String(bank)}
              entering={reduceMotion ? undefined : FadeInDown.duration(DURATION.panel)}
              className="gap-2.5 pt-1"
            >
              {guide.steps.map((step, index) => (
                <View key={index} className="flex-row gap-3">
                  <View className="h-6 w-6 items-center justify-center rounded-full bg-muted">
                    <Text className="text-xs font-semibold">{index + 1}</Text>
                  </View>
                  <Text variant="muted" className="flex-1 leading-5">
                    {step}
                  </Text>
                </View>
              ))}
              {guide.site && bank !== "other" && bank !== null ? (
                <Pressable
                  accessibilityRole="link"
                  onPress={() => void WebBrowser.openBrowserAsync(guide.site!)}
                  className="min-h-11 flex-row items-center gap-1.5 self-start"
                >
                  <Text className="text-sm font-medium underline">
                    {t("statements.openSite", { bank: BANK_NAMES[bank] })}
                  </Text>
                  <Ionicons name="open-outline" size={ICON.sm} color={colors.foreground} />
                </Pressable>
              ) : null}
            </Animated.View>
          ) : null}
        </Animated.View>
      ) : null}
    </Animated.View>
  );
}

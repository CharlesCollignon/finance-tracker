import { useState } from "react";
import { Pressable, View } from "react-native";
import { useRouter, type Href } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import {
  ARRIVED_HREF,
  CLOSE_HREF,
  PURCHASES_HREF,
  type AttentionItem,
} from "@finance/core/attention";
import { formatShortDate } from "@finance/core/constants";

import { Text } from "@/components/ui/Text";
import { cn } from "@/lib/cn";
import { hapticLight } from "@/lib/haptics";
import { reviewAsk } from "@/lib/review-ask";
import { useLocale, useT } from "@/providers/LocaleProvider";
import { ICON, TYPE } from "@/theme/tokens";
import { useThemeColors } from "@/theme/useThemeColors";

/** How many items the strip shows before folding the rest behind « +N ». */
const SHOWN = 3;

/**
 * « À faire »: everything waiting for the reader, in one strip under the
 * month picker, with its count — the web's strip.
 *
 * It replaces a row that named the top item and a « +N » for the rest, and
 * the two banners above it that each counted on their own. The decision
 * cards keep their place below; each line leads to where its thing is done,
 * or says so where it is done right here on this screen.
 *
 * Renders nothing when nothing is waiting — `buildAttention` builds no "all
 * clear" item.
 */
export function TodoStrip({ items }: { items: AttentionItem[] }) {
  const t = useT();
  const locale = useLocale();
  const router = useRouter();
  const colors = useThemeColors();
  const [open, setOpen] = useState(false);

  if (items.length === 0) {
    return null;
  }
  const shown = open ? items : items.slice(0, SHOWN);
  const hidden = items.length - shown.length;

  return (
    <View
      accessibilityRole="summary"
      accessibilityLabel={`${t("month.todo")} · ${items.length}`}
      className="rounded-card border border-border bg-card/70 px-card py-3"
    >
      <View className="mb-1 flex-row items-center gap-2">
        <Ionicons
          name="checkmark-done-outline"
          size={ICON.sm}
          color={colors.mutedForeground}
        />
        <Text className="text-sm font-medium text-muted-foreground">
          {t("month.todo")}
        </Text>
        <View className="rounded-full bg-muted px-2 py-0.5">
          <Text style={TYPE.micro} className="text-foreground">
            {String(items.length)}
          </Text>
        </View>
      </View>
      {shown.map((item) => {
        const vars = {
          ...item.params,
          ...(item.date ? { date: formatShortDate(item.date, locale) } : {}),
        };
        const to = attentionHref(item.href);
        const row = (
          <View className="min-h-11 flex-row items-center gap-3 py-1">
            <View
              className={cn(
                "h-2 w-2 shrink-0 rounded-full",
                item.tone === "wrong" ? "bg-destructive" : "bg-foreground",
              )}
            />
            <Text className="flex-1 text-sm">{t(item.messageKey, vars)}</Text>
            {to ? (
              <View className="shrink-0 flex-row items-center gap-1">
                <Text className="text-sm font-medium text-primary-ink">
                  {t(item.actionKey, vars)}
                </Text>
                <Ionicons
                  name="arrow-forward"
                  size={ICON.sm}
                  color={colors.primaryInk}
                />
              </View>
            ) : (
              <Ionicons
                name="arrow-down"
                size={ICON.sm}
                color={colors.mutedForeground}
              />
            )}
          </View>
        );
        return to ? (
          <Pressable
            key={item.id}
            accessibilityRole="button"
            accessibilityLabel={`${t(item.messageKey, vars)}. ${t(item.actionKey, vars)}`}
            hitSlop={4}
            onPress={() => {
              void hapticLight();
              router.push(to);
            }}
          >
            {row}
          </Pressable>
        ) : (
          <View key={item.id} accessible accessibilityLabel={t(item.messageKey, vars)}>
            {row}
          </View>
        );
      })}
      {hidden > 0 || open ? (
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ expanded: open }}
          hitSlop={8}
          onPress={() => {
            void hapticLight();
            setOpen((value) => !value);
          }}
          className="mt-1 flex-row items-center gap-1 self-start"
        >
          <Text style={TYPE.micro} className="text-muted-foreground">
            {open
              ? t("month.todoLess")
              : t("bearing.spine.moreWaiting", { count: hidden })}
          </Text>
          <Ionicons
            name={open ? "chevron-up" : "chevron-down"}
            size={ICON.sm}
            color={colors.mutedForeground}
          />
        </Pressable>
      ) : null}
    </View>
  );
}

/**
 * Where an item's action leads, on the phone; null for a thing done on Le
 * point itself.
 *
 * `buildAttention`'s `href`s are web routes from a closed set
 * (`/transactions`, `/transactions?review=inbox`, Le point asked to close,
 * its own two cards, `/recurring`, `/bank`, `/import`). The tabs and the
 * screens answer most of them unchanged; Le point is `index.tsx` here, where
 * the close lives on the momentum card, and its two cards are a little
 * further down this very screen. The review and the close are asked for
 * with a fresh stamp, so each opens even after it was closed once. The
 * « Fiabilité du mois » card's lines lead to the same places.
 */
export function attentionHref(href: string): Href | null {
  if (href === ARRIVED_HREF || href === PURCHASES_HREF) {
    return null;
  }
  if (href === "/transactions?review=inbox") {
    return { pathname: "/transactions", params: reviewAsk() } as Href;
  }
  if (href === CLOSE_HREF) {
    return {
      pathname: "/",
      params: { close: "1", at: String(Date.now()) },
    } as Href;
  }
  return href as Href;
}

import { Pressable, View } from "react-native";
import { useRouter, type Href } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import type { AttentionItem } from "@finance/core/attention";

import { Text } from "@/components/ui/Text";
import { cn } from "@/lib/cn";
import { useT } from "@/providers/LocaleProvider";
import { ICON, TYPE } from "@/theme/tokens";
import { useThemeColors } from "@/theme/useThemeColors";

/**
 * The one thing most worth doing next, and how many others are waiting.
 *
 * At the top of Le point, as on the web's Bearing: one line naming the most
 * useful thing to do and linking to where it is done. It states no figure
 * about the account, so it is right even on a first visit, and renders
 * nothing when nothing is waiting — `buildAttention` builds no "all clear"
 * item.
 */
export function AttentionRow({
  attention,
  className,
}: {
  attention: AttentionItem[];
  className?: string;
}) {
  const t = useT();
  const router = useRouter();
  const colors = useThemeColors();

  const top = attention[0];
  const rest = attention.length - 1;

  if (!top) {
    return null;
  }

  return (
    <Pressable
      onPress={() => router.push(attentionHref(top.href) as Href)}
      accessibilityRole="button"
      accessibilityLabel={`${t(top.messageKey, top.params)}. ${t(top.actionKey)}`}
      className={cn("flex-row items-center gap-3 py-1", className)}
      hitSlop={8}
    >
      <View
        className={cn(
          "h-2 w-2 shrink-0 rounded-full",
          top.tone === "wrong" ? "bg-destructive" : "bg-primary",
        )}
      />
      <Text numberOfLines={1} className="flex-1 text-sm">
        {t(top.messageKey, top.params)}
      </Text>
      {rest > 0 ? (
        <Text style={TYPE.micro} className="shrink-0 text-muted-foreground">
          {t("bearing.spine.moreWaiting", { count: rest })}
        </Text>
      ) : null}
      <View className="shrink-0 flex-row items-center gap-1">
        <Text className="text-sm font-medium text-primary-ink">
          {t(top.actionKey)}
        </Text>
        <Ionicons
          name="arrow-forward"
          size={ICON.sm}
          color={colors.primaryInk}
        />
      </View>
    </Pressable>
  );
}

/**
 * Where an attention row's action leads, on the phone.
 *
 * `buildAttention`'s `href`s are web routes from a closed set of five
 * (`/transactions`, `/transactions?review=inbox`, `/plan` twice,
 * `/recurring`). `transactions.tsx` and `recurring.tsx` are real tabs and
 * answer three of them unchanged; the phone's Plan is `planning.tsx`, where
 * the close and the ready-to-close prompt live.
 */
function attentionHref(href: string): string {
  return href === "/plan" ? "/planning" : href;
}

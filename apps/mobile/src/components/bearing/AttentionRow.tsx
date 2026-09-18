import { Pressable, View } from "react-native";
import { useRouter, type Href } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import type { AttentionItem } from "@finance/core/attention";
import { PHONE_PATHS } from "@finance/core/bearing-tiles";

import { Text } from "@/components/ui/Text";
import { cn } from "@/lib/cn";
import { useT } from "@/providers/LocaleProvider";
import { ICON, TYPE } from "@/theme/tokens";
import { useThemeColors } from "@/theme/useThemeColors";

/**
 * The one thing most worth doing next, and how many others are waiting.
 *
 * Lifted out of `Spine` because the reader who needs it most never reached
 * `Spine` at all: `(tabs)/index.tsx` returns its `thin` empty state before
 * the spine mounts, and `thin` is exactly what somebody who has just
 * finished onboarding looks like — templates saved, not one row written, so
 * `recurringToApply` is already non-zero and this list already has an item
 * in it. It was being built and discarded for them.
 *
 * Only the row moved. A headline and a ring over an account with nothing in
 * it would be worse than nothing: the headline falls back to the month's
 * plain arithmetic, which on a new account is a hero-sized zero, and the
 * ring would be dark — two statements about a position nobody has taken
 * yet. This row states no figure about the account at all.
 *
 * Renders nothing when nothing is waiting, for the same reason
 * `buildAttention` builds no "all clear" item.
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
 * `buildAttention`'s `href`s are a web route from a fixed, closed set of
 * five (`/transactions`, `/transactions?review=inbox`, `/budgets` twice,
 * `/recurring`) — a different vocabulary from a bearing tile's, and NOT
 * covered by `phoneHref` from `@finance/core/bearing-tiles`: that function
 * falls through to the raw href for anything not in its own table, which is
 * the exact silent pass-through that shipped 15 dead phone links on the
 * predecessor plan, and its table is documented as a translation of the
 * *tile* catalogue's own paths, not a general web-to-phone router. So this
 * checks the attention set by hand against `apps/mobile/src/app/(tabs)/`:
 * `transactions.tsx` and `recurring.tsx` are real tabs and answer
 * `/transactions`, `/transactions?review=inbox` and `/recurring` unchanged;
 * there is no `budgets` route at all, and its answer — the caps, the close
 * and the ready-to-close prompt this item is about — lives on
 * `planning.tsx`.
 *
 * *Which* hrefs get redirected is this function's own, separately-verified
 * judgement — the four-way check above. *Where* `/budgets` redirects to is
 * not: that is one fact about this app's route topology, already owned by
 * `PHONE_PATHS["/budgets"]` in `bearing-tiles.ts`, so this reads it from
 * there rather than retyping `"/planning"` as a second literal that table's
 * own future edits would have no way to reach.
 */
function attentionHref(href: string): string {
  return href === "/budgets" ? PHONE_PATHS["/budgets"] : href;
}

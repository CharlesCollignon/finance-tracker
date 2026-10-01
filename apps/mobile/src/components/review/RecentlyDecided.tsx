import { Pressable, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import type { DecidedFeedGroup } from "@finance/core/bank-decided-groups";
import { formatShortDate } from "@finance/core/constants";

import { PrivateAmount } from "@/components/PrivateAmount";
import { Text } from "@/components/ui/Text";
import { cn } from "@/lib/cn";
import type { DecidedFeedRow } from "@/lib/review-data";
import { useFormatCurrency } from "@/providers/CurrencyProvider";
import { useLocale, useT } from "@/providers/LocaleProvider";
import { ICON } from "@/theme/tokens";
import { useThemeColors } from "@/theme/useThemeColors";

interface RecentlyDecidedProps {
  groups: DecidedFeedGroup<DecidedFeedRow>[];
  pending: boolean;
  onChangeCategory: (group: DecidedFeedGroup<DecidedFeedRow>) => void;
  onUndo: (group: DecidedFeedGroup<DecidedFeedRow>) => void;
}

/**
 * What the review decided lately, so a decision can be taken back.
 *
 * Read from the database rather than remembered by the sheet, which is the
 * difference from the phone's earlier "decided just now" list: closing the
 * sheet, or the app, no longer closes the door on a card payment filed in
 * the wrong place. One line per decision — a shop filed with one answer
 * comes back with one press.
 */
export function RecentlyDecided({
  groups,
  pending,
  onChangeCategory,
  onUndo,
}: RecentlyDecidedProps) {
  const t = useT();
  const locale = useLocale();
  const formatEuro = useFormatCurrency();
  const colors = useThemeColors();

  if (groups.length === 0) {
    return null;
  }

  return (
    <View className="gap-2 border-t border-border pt-5">
      <Text variant="label">{t("inbox.recentlyDecided")}</Text>
      <Text variant="muted" className="text-sm">
        {t("inbox.putOneBack")}
      </Text>

      <View>
        {groups.map((group, index) => {
          const categoryName = group.rows[0]!.categoryName;
          const outcome =
            group.status === "ignored"
              ? group.count === 1
                ? t("inbox.leftOut")
                : t("inboxGroups.leftOut", { count: group.count })
              : [
                  group.count > 1
                    ? t("inboxGroups.entries", { count: group.count })
                    : null,
                  categoryName ?? t("inbox.inYourLedger"),
                ]
                  .filter(Boolean)
                  .join(" · ");
          return (
            <View
              key={group.key}
              className={cn(
                "gap-1 py-3",
                index > 0 && "border-t border-border",
              )}
            >
              <View className="flex-row items-start justify-between gap-3">
                <Text className="min-w-0 flex-1 text-sm">{group.name}</Text>
                <PrivateAmount
                  className={cn(
                    "text-sm",
                    group.direction === "in"
                      ? "text-success"
                      : "text-destructive",
                  )}
                >
                  {`${group.direction === "in" ? "+" : "−"}${formatEuro(group.total)}`}
                </PrivateAmount>
              </View>
              <Text variant="muted" className="text-xs">
                {`${formatShortDate(group.lastOn, locale)} · ${outcome}`}
              </Text>
              <View className="flex-row items-center gap-4">
                {group.status === "imported" ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`${t("inbox.changeCategory")} — ${group.name}`}
                    accessibilityState={{ disabled: pending }}
                    disabled={pending}
                    hitSlop={8}
                    onPress={() => onChangeCategory(group)}
                    className="min-h-11 justify-center"
                  >
                    <Text className="text-sm font-medium">
                      {t("inbox.changeCategory")}
                    </Text>
                  </Pressable>
                ) : null}
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`${t("inbox.undo")} — ${group.name}`}
                  accessibilityState={{ disabled: pending }}
                  disabled={pending}
                  hitSlop={8}
                  onPress={() => onUndo(group)}
                  className="min-h-11 flex-row items-center gap-1"
                >
                  <Ionicons
                    name="arrow-undo-outline"
                    size={ICON.sm}
                    color={colors.mutedForeground}
                  />
                  <Text variant="muted" className="text-sm">
                    {t("inbox.undo")}
                  </Text>
                </Pressable>
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

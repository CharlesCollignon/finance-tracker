import { Pressable, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import type { FeedGroup } from "@finance/core/bank-inbox-groups";
import { formatDayMonth, formatShortDate } from "@finance/core/constants";
import type { Category } from "@finance/core/types/database";

import { CategoryIcon } from "@/components/CategoryIcon";
import { PrivateAmount } from "@/components/PrivateAmount";
import { Button } from "@/components/ui/Button";
import { Text } from "@/components/ui/Text";
import { cn } from "@/lib/cn";
import { hapticLight } from "@/lib/haptics";
import type { PendingFeedRow } from "@/lib/queries";
import { useFormatCurrency } from "@/providers/CurrencyProvider";
import { useLocale, useT } from "@/providers/LocaleProvider";
import { ICON } from "@/theme/tokens";
import { useThemeColors } from "@/theme/useThemeColors";

type Group = FeedGroup<PendingFeedRow>;

interface ReviewGroupCardProps {
  group: Group;
  categories: Category[];
  /** The category chosen for the group, or for one of its rows, by key. */
  choices: Record<string, string>;
  expanded: boolean;
  onToggle: () => void;
  /** Open the category list for the group (`key` = group key) or a row. */
  onChoose: (key: string, title: string) => void;
  onFile: () => void;
  onLeaveOut: () => void;
  onFileRow: (row: PendingFeedRow) => void;
  onLeaveOutRow: (row: PendingFeedRow) => void;
}

/**
 * Money in reads green and money out reads red, on the bank's own direction —
 * not the category's colour, which is what the ledger uses: at this point
 * there is no category yet, and deciding it is the whole job.
 */
function Signed({
  direction,
  amount,
  className,
}: {
  direction: "in" | "out";
  amount: number;
  className?: string;
}) {
  const formatEuro = useFormatCurrency();
  return (
    <PrivateAmount
      className={cn(
        direction === "in" ? "text-success" : "text-destructive",
        className,
      )}
    >
      {`${direction === "in" ? "+" : "−"}${formatEuro(amount)}`}
    </PrivateAmount>
  );
}

/** The button that shows, and opens, the category a decision will use. */
function CategoryButton({
  category,
  label,
  onPress,
}: {
  category: Category | undefined;
  label: string;
  onPress: () => void;
}) {
  const t = useT();
  const colors = useThemeColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={category?.name}
      onPress={() => {
        void hapticLight();
        onPress();
      }}
      className="min-h-11 flex-row items-center gap-2 rounded-control border border-border px-3 py-2"
    >
      {category ? (
        <CategoryIcon icon={category.icon} className="h-6 w-6" />
      ) : null}
      <Text
        numberOfLines={1}
        className={cn(
          "min-w-0 flex-1 text-sm",
          !category && "text-muted-foreground",
        )}
      >
        {category?.name ?? t("inboxGroups.whichCategory")}
      </Text>
      <Ionicons
        name="chevron-down"
        size={ICON.sm}
        color={colors.mutedForeground}
      />
    </Pressable>
  );
}

/**
 * One shop's waiting rows, answered together — the web review's group, at
 * phone width. A shop already filed more than one way opens row by row,
 * because one answer for all of it would be a guess.
 */
export function ReviewGroupCard({
  group,
  categories,
  choices,
  expanded,
  onToggle,
  onChoose,
  onFile,
  onLeaveOut,
  onFileRow,
  onLeaveOutRow,
}: ReviewGroupCardProps) {
  const t = useT();
  const locale = useLocale();
  const formatEuro = useFormatCurrency();
  const colors = useThemeColors();
  const single = group.count === 1;
  const only = group.rows[0]!;
  const entries = t("inboxGroups.entries", { count: group.count });
  const chosen = choices[group.key] ?? group.suggestedCategoryId ?? "";
  const category = categories.find((option) => option.id === chosen);
  const range =
    group.firstOn === group.lastOn
      ? formatDayMonth(group.firstOn, locale)
      : `${formatDayMonth(group.firstOn, locale)} – ${formatDayMonth(group.lastOn, locale)}`;

  return (
    <View
      accessibilityLabel={t("inboxGroups.groupLabel", {
        name: group.name,
        entries,
        amount: formatEuro(group.total),
      })}
      className="gap-3 rounded-control border border-border p-3"
    >
      <View className="flex-row items-start justify-between gap-3">
        {single ? (
          <View className="min-w-0 flex-1">
            {/* Wraps rather than truncates: the whole decision is what the
                line says, and "PRELEVEMENT Navi…" answers nothing. */}
            <Text className="text-sm font-medium">{group.name}</Text>
            <Text variant="muted" className="text-xs">
              {`${formatShortDate(only.occurredOn, locale)} · ${only.why}`}
            </Text>
          </View>
        ) : (
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ expanded }}
            accessibilityHint={
              expanded ? t("inboxGroups.hideRows") : t("inboxGroups.showRows")
            }
            onPress={() => {
              void hapticLight();
              onToggle();
            }}
            className="min-w-0 flex-1 flex-row items-start gap-1.5"
          >
            <Ionicons
              name={expanded ? "chevron-down" : "chevron-forward"}
              size={ICON.sm}
              color={colors.mutedForeground}
              style={{ marginTop: 2 }}
            />
            <View className="min-w-0 flex-1">
              <Text className="text-sm font-medium">{group.name}</Text>
              <Text variant="muted" className="text-xs">
                {`${entries} · ${range}`}
              </Text>
            </View>
          </Pressable>
        )}
        <Signed
          direction={group.direction}
          amount={group.total}
          className="text-sm font-semibold"
        />
      </View>

      {group.mixed ? (
        <Text variant="muted" className="text-xs">
          {t("inboxGroups.mixed")}
        </Text>
      ) : null}

      <CategoryButton
        category={category}
        label={t("inboxGroups.whichCategory")}
        onPress={() => onChoose(group.key, group.name)}
      />
      <View className="flex-row items-center gap-2">
        <Button
          label={single ? t("inbox.add") : t("inboxGroups.fileAll")}
          size="sm"
          className="flex-1"
          disabled={!chosen}
          onPress={onFile}
        />
        <Button
          label={single ? t("inbox.leaveOut") : t("inboxGroups.leaveOutAll")}
          variant="ghost"
          size="sm"
          onPress={onLeaveOut}
        />
      </View>

      {expanded && !single ? (
        <View className="border-t border-border">
          {group.rows.map((row, index) => {
            const rowChoice = choices[row.id] ?? "";
            const rowCategory = categories.find(
              (option) => option.id === rowChoice,
            );
            const name = row.counterparty?.trim() || row.note;
            return (
              <View
                key={row.id}
                className={cn(
                  "gap-2 py-3",
                  index > 0 && "border-t border-border",
                )}
              >
                <View className="flex-row items-start justify-between gap-3">
                  <View className="min-w-0 flex-1">
                    <Text className="text-sm">{name}</Text>
                    <Text variant="muted" className="text-xs">
                      {`${formatShortDate(row.occurredOn, locale)} · ${row.why}`}
                    </Text>
                  </View>
                  <Signed
                    direction={row.direction}
                    amount={row.amount}
                    className="text-sm"
                  />
                </View>
                <CategoryButton
                  category={rowCategory}
                  label={t("inboxGroups.whichCategory")}
                  onPress={() => onChoose(row.id, name)}
                />
                <View className="flex-row items-center gap-2">
                  <Button
                    label={t("inbox.add")}
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    disabled={!rowChoice}
                    onPress={() => onFileRow(row)}
                  />
                  <Button
                    label={t("inbox.leaveOut")}
                    variant="ghost"
                    size="sm"
                    onPress={() => onLeaveOutRow(row)}
                  />
                </View>
              </View>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

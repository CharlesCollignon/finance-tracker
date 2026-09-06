import { Children, cloneElement, isValidElement, type ReactNode } from "react";
import { Pressable, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { Card } from "@/components/ui/Card";
import { Text } from "@/components/ui/Text";
import { cn } from "@/lib/cn";
import { hapticSelection } from "@/lib/haptics";
import { useThemeColors } from "@/theme/useThemeColors";
import { ICON } from "@/theme/tokens";

/**
 * The settings row, and the group it sits in.
 *
 * Settings had been one card per subject, each with a heading, a paragraph
 * explaining itself and a button — nine of them down a scroll, which is a lot
 * of reading to arrive at a switch. A row states the setting and shows its
 * value, and the paragraph is only worth its space when the setting is doing
 * something non-obvious.
 *
 * Press feedback here is a background wash rather than the scale the buttons
 * use: a full-width row that shrinks under a thumb reads as the list moving,
 * not as the row responding.
 */

export interface ListRowProps {
  icon?: keyof typeof Ionicons.glyphMap;
  label: string;
  /** Right-aligned current setting — "EUR", "3 passkeys", an account name. */
  value?: string;
  /** A switch, a badge, anything replacing the chevron. */
  trailing?: ReactNode;
  onPress?: () => void;
  /** Deletions read in the destructive colour, icon included. */
  destructive?: boolean;
  disabled?: boolean;
  /** Set by ListSection so the group's last row draws no divider. */
  last?: boolean;
  /** Revealed under the row — an editor, a confirmation, a sub-list. */
  expanded?: ReactNode;
}

export function ListRow({
  icon,
  label,
  value,
  trailing,
  onPress,
  destructive,
  disabled,
  last,
  expanded,
}: ListRowProps) {
  const colors = useThemeColors();
  const tint = destructive ? colors.destructive : colors.primary;

  const body = (
    <View className="min-h-14 flex-row items-center gap-3 px-5 py-3.5">
      {icon ? (
        <Ionicons
          name={icon}
          size={ICON.lg}
          color={disabled ? colors.mutedForeground : tint}
        />
      ) : null}
      <Text
        className={cn(
          "flex-1",
          destructive && "text-destructive",
          disabled && "text-muted-foreground",
        )}
      >
        {label}
      </Text>
      {value ? (
        <Text variant="muted" numberOfLines={1}>
          {value}
        </Text>
      ) : null}
      {trailing ??
        (onPress ? (
          <Ionicons
            name="chevron-forward"
            size={ICON.md}
            color={colors.mutedForeground}
          />
        ) : null)}
    </View>
  );

  return (
    <View>
      {onPress ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={value ? `${label}, ${value}` : label}
          disabled={disabled}
          onPress={() => {
            void hapticSelection();
            onPress();
          }}
          style={({ pressed }) => ({
            backgroundColor: pressed ? colors.secondary : "transparent",
          })}
        >
          {body}
        </Pressable>
      ) : (
        body
      )}

      {expanded ? <View className="px-5 pb-4">{expanded}</View> : null}

      {/* Inset to the label, so the icon column reads as one strip. */}
      {!last ? <View className="ml-14 h-px bg-border" /> : null}
    </View>
  );
}

export function ListSection({
  title,
  footer,
  children,
}: {
  title?: string;
  /** The one caveat a row cannot carry — "this does not convert amounts". */
  footer?: string;
  children: ReactNode;
}) {
  const rows = Children.toArray(children).filter(isValidElement);

  return (
    <View className="gap-2">
      {title ? (
        <Text variant="label" className="px-1">
          {title}
        </Text>
      ) : null}
      <Card bezel innerClassName="overflow-hidden p-0">
        {rows.map((row, index) =>
          cloneElement(row as React.ReactElement<ListRowProps>, {
            last: index === rows.length - 1,
          }),
        )}
      </Card>
      {footer ? (
        <Text variant="micro" className="px-1">
          {footer}
        </Text>
      ) : null}
    </View>
  );
}

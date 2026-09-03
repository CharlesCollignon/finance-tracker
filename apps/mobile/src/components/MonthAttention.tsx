import { Pressable, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { Text } from "@/components/ui/Text";
import { cn } from "@/lib/cn";
import { hapticLight } from "@/lib/haptics";
import { useThemeColors } from "@/theme/useThemeColors";

export interface AttentionItem {
  /** Stable key, and the reason this row exists. */
  id: string;
  /** What is waiting, in the user's words. */
  text: string;
  /**
   * How the decision gets made. A route on web; here it is a callback,
   * because half of these open a sheet on this screen rather than navigate.
   */
  onPress: () => void;
  action: string;
  /**
   * Whether this is something gone wrong or merely something outstanding.
   * Most of the time it is the latter, and dressing it in red teaches people
   * to ignore the colour when it finally means something.
   */
  tone?: "waiting" | "wrong";
}

interface MonthAttentionProps {
  items: AttentionItem[];
}

/**
 * The only part of the month that wants a decision.
 *
 * Home used to open with a figure and then stack a card per outstanding
 * thing — one for recurring, one for the close — while the rest hid on other
 * tabs. The figure is not urgent. These are, and they are finite: when there
 * is nothing outstanding this block is not empty, it is absent, which is the
 * strongest thing an interface can say about a quiet month.
 */
export function MonthAttention({ items }: MonthAttentionProps) {
  const colors = useThemeColors();

  if (items.length === 0) {
    return null;
  }

  return (
    <View
      accessibilityLabel="Needs you"
      className="overflow-hidden rounded-xl border bg-card"
      style={{ borderColor: colors.primaryRim }}
    >
      <Text className="border-b border-border px-4 py-2.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
        Needs you
      </Text>
      {items.map((item, index) => (
        <Pressable
          key={item.id}
          accessibilityRole="button"
          accessibilityLabel={`${item.text}. ${item.action}`}
          onPress={() => {
            void hapticLight();
            item.onPress();
          }}
          className={cn(
            "min-h-14 flex-row items-center gap-3 px-4 py-3",
            index > 0 && "border-t border-border",
          )}
        >
          <View
            className="h-2 w-2 rounded-full"
            style={{
              backgroundColor:
                item.tone === "wrong" ? colors.destructive : colors.primary,
            }}
          />
          <Text className="min-w-0 flex-1 text-sm">{item.text}</Text>
          <View className="flex-row items-center gap-1">
            <Text className="text-sm font-medium text-primary-ink">
              {item.action}
            </Text>
            <Ionicons
              name="arrow-forward"
              size={14}
              color={colors.primaryInk}
            />
          </View>
        </Pressable>
      ))}
    </View>
  );
}

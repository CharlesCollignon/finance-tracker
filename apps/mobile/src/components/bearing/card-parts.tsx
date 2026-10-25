import { type ComponentProps, type ReactNode } from "react";
import { Pressable, View } from "react-native";
import { useRouter, type Href } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Animated, { useReducedMotion } from "react-native-reanimated";
import { PrivateAmount } from "@/components/PrivateAmount";
import { Text } from "@/components/ui/Text";
import { cn } from "@/lib/cn";
import { hapticLight } from "@/lib/haptics";
import { useFormatCurrency } from "@/providers/CurrencyProvider";
import { ICON } from "@/theme/tokens";
import { useThemeColors } from "@/theme/useThemeColors";
import { FADE_IN } from "@/components/motion/fade";

/**
 * What Le point's cards are made of on the phone: the card itself, the
 * change against last month, a pill, a bar that fades in. Each card is a
 * file beside this one (`BalanceCard.tsx`, `SpentCard.tsx`…), the web's
 * twins in `components/finance/bearing/`.
 */

type IconName = ComponentProps<typeof Ionicons>["name"];

/* ------------------------------------------------------------ the shells */

/**
 * A card on this screen: a small icon and title, and — where another screen
 * explains its figures — an arrow there. The web's own card, translated.
 */
export function HomeCard({
  icon,
  title,
  href,
  hrefLabel,
  action,
  children,
}: {
  icon: IconName;
  title: string;
  href?: string;
  hrefLabel?: string;
  /** A control of the card's own, beside its link: a switch. */
  action?: ReactNode;
  children: ReactNode;
}) {
  const router = useRouter();
  const colors = useThemeColors();

  return (
    <View className="gap-4 rounded-card border border-border bg-card/70 p-card">
      <View className="flex-row items-center justify-between gap-3">
        <View className="min-w-0 flex-1 flex-row items-center gap-2">
          <View className="h-7 w-7 items-center justify-center rounded-full bg-muted">
            <Ionicons name={icon} size={ICON.sm} color={colors.foreground} />
          </View>
          <Text
            accessibilityRole="header"
            numberOfLines={1}
            className="shrink text-sm font-medium text-muted-foreground"
          >
            {title}
          </Text>
        </View>
        {action}
        {href ? (
          <Pressable
            accessibilityRole="link"
            accessibilityLabel={hrefLabel ?? title}
            hitSlop={6}
            onPress={() => {
              void hapticLight();
              router.push(href as Href);
            }}
            className="h-9 w-9 items-center justify-center rounded-full"
          >
            <Ionicons
              name="arrow-forward"
              size={ICON.md}
              color={colors.mutedForeground}
            />
          </Pressable>
        ) : null}
      </View>
      {children}
    </View>
  );
}

/** A signed difference, as a pill: up is green and down is red, with an arrow. */
export function DeltaChip({ value, label }: { value: number; label: string }) {
  const format = useFormatCurrency();
  const colors = useThemeColors();
  const up = value >= 0;
  return (
    <View
      accessible
      accessibilityLabel={label}
      className={cn(
        "flex-row items-center gap-1 self-start rounded-full px-2.5 py-1",
        up ? "bg-success/10" : "bg-destructive/10",
      )}
    >
      <Ionicons
        name={up ? "arrow-up" : "arrow-down"}
        size={ICON.xs}
        color={up ? colors.success : colors.destructive}
      />
      <PrivateAmount
        className={cn(
          "text-xs font-medium",
          up ? "text-success" : "text-destructive",
        )}
      >
        {`${up ? "+" : "−"}${format(Math.abs(value))}`}
      </PrivateAmount>
    </View>
  );
}

/** A label-and-dot pill under the balance: the lowest day, what is to come. */
export function Pill({
  children,
  dot,
  tone = "default",
}: {
  children: string;
  dot?: string;
  tone?: "default" | "danger";
}) {
  return (
    <View
      className={cn(
        "flex-row items-center gap-1.5 rounded-full border px-3 py-1.5",
        tone === "danger" ? "border-destructive/40" : "border-border",
      )}
    >
      {dot ? (
        <View
          className="h-1.5 w-1.5 rounded-full"
          style={{ backgroundColor: dot }}
        />
      ) : null}
      <PrivateAmount
        className={cn(
          "text-xs",
          tone === "danger" ? "text-destructive" : "text-muted-foreground",
        )}
      >
        {children}
      </PrivateAmount>
    </View>
  );
}

/**
 * A thin meter at its value, fading in on arrival as the web's bars do.
 */
export function GrowBar({ ratio, color }: { ratio: number; color: string }) {
  const reduce = useReducedMotion();
  const clamped = Math.max(0, Math.min(1, ratio));

  return (
    <View className="h-1.5 overflow-hidden rounded-full bg-foreground/10">
      <Animated.View
        entering={reduce ? undefined : FADE_IN}
        className="h-full rounded-full"
        style={{ width: `${clamped * 100}%`, backgroundColor: color }}
      />
    </View>
  );
}

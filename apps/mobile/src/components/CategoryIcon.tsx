import { Ionicons } from "@expo/vector-icons";
import { View } from "react-native";
import type { ComponentProps } from "react";

import { cn } from "@/lib/cn";
import { useThemeColors } from "@/theme/useThemeColors";

type IoniconName = ComponentProps<typeof Ionicons>["name"];

/** Same icon keys the web CategoryIcon maps, resolved to Ionicons. */
export const CATEGORY_ICONS: Record<string, IoniconName> = {
  wallet: "wallet-outline",
  lightning: "flash-outline",
  wifi: "wifi-outline",
  buildings: "business-outline",
  house: "home-outline",
  bank: "business-outline",
  "credit-card": "card-outline",
  shield: "shield-outline",
  "shopping-cart": "cart-outline",
  barbell: "barbell-outline",
  car: "car-outline",
  television: "tv-outline",
  "dots-three": "ellipsis-horizontal",
  "piggy-bank": "cash-outline",
  "chart-line": "analytics-outline",
  "currency-btc": "logo-bitcoin",
  "trend-up": "trending-up-outline",
};

interface CategoryIconProps {
  icon: string | null;
  className?: string;
}

export function CategoryIcon({ icon, className }: CategoryIconProps) {
  const colors = useThemeColors();
  const name = (icon && CATEGORY_ICONS[icon]) || "ellipsis-horizontal";

  return (
    <View
      className={cn(
        "h-9 w-9 items-center justify-center rounded-md border border-border bg-muted/30",
        className,
      )}
    >
      <Ionicons name={name} size={18} color={colors.foreground} />
    </View>
  );
}

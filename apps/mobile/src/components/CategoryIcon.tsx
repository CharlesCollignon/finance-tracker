import { Ionicons } from "@expo/vector-icons";
import { Image, View } from "react-native";
import type { ComponentProps } from "react";

import { BITCOIN_MARK } from "@/lib/bitcoin-mark";
import { cn } from "@/lib/cn";
import { useThemeColors } from "@/theme/useThemeColors";
import { ICON } from "@/theme/tokens";

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
        "h-9 w-9 items-center justify-center rounded-control border border-border bg-muted/30",
        className,
      )}
    >
      {/* Bitcoin's own mark rather than a glyph, wherever a category
          wears it. */}
      {icon === "currency-btc" ? (
        <Image
          source={BITCOIN_MARK}
          style={{ width: ICON.lg, height: ICON.lg, borderRadius: ICON.lg / 2 }}
          accessibilityIgnoresInvertColors
        />
      ) : (
        <Ionicons name={name} size={ICON.lg} color={colors.foreground} />
      )}
    </View>
  );
}

/**
 * The glyph alone, without the tile around it, in an ink the caller picks:
 * the Add sheet draws its own disc, filled in the kind's colour once chosen.
 */
export function CategoryGlyph({
  icon,
  color,
  size = ICON.xl,
}: {
  icon: string | null;
  color: string;
  size?: number;
}) {
  if (icon === "currency-btc") {
    return (
      <Image
        source={BITCOIN_MARK}
        style={{ width: size, height: size, borderRadius: size / 2 }}
        accessibilityIgnoresInvertColors
      />
    );
  }
  const name = (icon && CATEGORY_ICONS[icon]) || "ellipsis-horizontal";
  return <Ionicons name={name} size={size} color={color} />;
}

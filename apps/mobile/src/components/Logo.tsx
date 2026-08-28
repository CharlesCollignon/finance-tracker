import { Image, View, type ViewProps } from "react-native";

import { cn } from "@/lib/cn";
import { useThemeColors } from "@/theme/useThemeColors";

type LogoSize = "sm" | "nav" | "hero" | "watermark";

export interface LogoProps extends ViewProps {
  size?: LogoSize;
  /** Overrides the tint; defaults to the theme's foreground. */
  color?: string;
  className?: string;
}

const BOX: Record<LogoSize, number> = {
  sm: 26,
  nav: 40,
  hero: 88,
  watermark: 320,
};

/**
 * Pluclair mark.
 *
 * The artwork is a white glyph on transparency, which would disappear against
 * the light theme, so it is tinted to the current foreground rather than left
 * white. Callers can override the tint where the surface is fixed.
 */
export function Logo({
  size = "nav",
  color,
  className,
  style,
  ...props
}: LogoProps) {
  const colors = useThemeColors();
  const box = BOX[size];

  return (
    <View
      accessibilityRole="image"
      accessibilityLabel="Pluclair"
      className={cn("items-center justify-center", className)}
      style={[{ width: box, height: box }, style]}
      {...props}
    >
      <Image
        source={require("../../assets/images/logo-mark.png")}
        style={{ width: box, height: box }}
        resizeMode="contain"
        tintColor={color ?? colors.foreground}
      />
    </View>
  );
}

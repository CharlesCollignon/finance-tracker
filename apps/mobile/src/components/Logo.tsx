import { Image, View, type ViewProps } from "react-native";

import { cn } from "@/lib/cn";

type LogoSize = "sm" | "nav" | "hero" | "watermark";

export interface LogoProps extends ViewProps {
  size?: LogoSize;
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
 * Full-colour artwork, so it is deliberately not tinted — the glass and glow
 * are the mark. Its black ground was converted to alpha, so the halo composites
 * onto whatever surface it sits on rather than carrying a black rectangle.
 */
export function Logo({ size = "nav", className, style, ...props }: LogoProps) {
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
      />
    </View>
  );
}

import { Image, View, type ViewProps } from "react-native";

import { cn } from "@/lib/cn";

type LogoSize = "sm" | "nav" | "hero";

export interface LogoProps extends ViewProps {
  size?: LogoSize;
  className?: string;
}

const BOX: Record<LogoSize, number> = {
  sm: 28,
  nav: 40,
  hero: 88,
};

/**
 * Pluclair mark. The artwork already carries its own rounded tile and
 * transparent corners, so it sits correctly on any surface in either theme.
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

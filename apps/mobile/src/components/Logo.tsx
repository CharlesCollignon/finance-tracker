import { Text, type TextProps } from "react-native";

import { cn } from "@/lib/cn";

type LogoSize = "nav" | "hero";

export interface LogoProps extends TextProps {
  size?: LogoSize;
  className?: string;
}

const SIZE_CLASS: Record<LogoSize, string> = {
  nav: "text-3xl",
  hero: "text-5xl",
};

/**
 * Pluclair wordmark in Orbit (loaded via expo-font in root layout).
 */
export function Logo({ size = "nav", className, style, ...props }: LogoProps) {
  return (
    <Text
      accessibilityLabel="Pluclair"
      className={cn("text-foreground", SIZE_CLASS[size], className)}
      style={[{ fontFamily: "Orbit" }, style]}
      {...props}
    >
      Pluclair
    </Text>
  );
}

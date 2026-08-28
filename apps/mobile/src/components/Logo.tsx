import { Text, View, type ViewProps } from "react-native";

import { cn } from "@/lib/cn";

type LogoSize = "nav" | "hero";

export interface LogoProps extends ViewProps {
  size?: LogoSize;
  className?: string;
}

const SIZES: Record<LogoSize, { box: number; font: number; radius: number }> = {
  nav: { box: 40, font: 24, radius: 13 },
  hero: { box: 88, font: 52, radius: 28 },
};

/**
 * Pluclair mark: the "P" in Orbit on a dark rounded tile, matching the app
 * icon. The tile stays dark in both themes so the mark reads identically
 * everywhere; the hairline border is what keeps its edge visible once the
 * surface behind it goes dark too.
 */
export function Logo({ size = "nav", className, style, ...props }: LogoProps) {
  const { box, font, radius } = SIZES[size];

  return (
    <View
      accessibilityRole="image"
      accessibilityLabel="Pluclair"
      className={cn("items-center justify-center border border-border", className)}
      style={[
        {
          width: box,
          height: box,
          borderRadius: radius,
          backgroundColor: "#15100a",
        },
        style,
      ]}
      {...props}
    >
      <Text
        style={{
          fontFamily: "Orbit",
          fontSize: font,
          color: "#ffffff",
          includeFontPadding: false,
        }}
      >
        P
      </Text>
    </View>
  );
}

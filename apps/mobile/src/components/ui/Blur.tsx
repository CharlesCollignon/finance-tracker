import { BlurView } from "@sbaiahmed1/react-native-blur";
import { useColorScheme, type StyleProp, type ViewStyle } from "react-native";
import type { ReactNode } from "react";

interface BlurProps {
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** 0-100. */
  amount?: number;
  /** Tint laid over the blur; keeps contrast where the blur alone is weak. */
  overlayColor?: string;
}

/**
 * Themed blur surface. Wraps the native blur so every frosted surface in the
 * app picks the same tint and strength, and so the library is referenced in
 * one place.
 */
export function Blur({
  children,
  style,
  amount = 24,
  overlayColor,
}: BlurProps) {
  const scheme = useColorScheme();
  const isDark = scheme !== "light";

  return (
    <BlurView
      blurType={isDark ? "dark" : "light"}
      blurAmount={amount}
      // Android composites fewer passes than iOS; more rounds keeps it smooth.
      blurRounds={8}
      overlayColor={
        overlayColor ??
        (isDark ? "rgba(11,9,5,0.35)" : "rgba(251,250,247,0.35)")
      }
      style={style}
    >
      {children}
    </BlurView>
  );
}

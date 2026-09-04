import { BlurView } from "@sbaiahmed1/react-native-blur";
import type { StyleProp, ViewStyle } from "react-native";
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
 * Blur surface. Wraps the native blur so every frosted surface in the app
 * picks the same tint and strength, and so the library is referenced in one
 * place. Always dark: there is one palette.
 */
export function Blur({
  children,
  style,
  amount = 24,
  overlayColor,
}: BlurProps) {
  return (
    <BlurView
      blurType="dark"
      blurAmount={amount}
      // Android composites fewer passes than iOS; more rounds keeps it smooth.
      blurRounds={8}
      overlayColor={overlayColor ?? "rgba(11,9,5,0.35)"}
      style={style}
    >
      {children}
    </BlurView>
  );
}

import { BlurView } from "@sbaiahmed1/react-native-blur";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
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
  // A tint of the caller's own is laid as a view of its own, over the blur.
  // Handed to the library, Android drops it whenever the blur has no
  // children: its native view takes only the blur type's grey, so the gold
  // add button came out a dark disc with its dark plus lost inside.
  return (
    <BlurView
      blurType="dark"
      blurAmount={amount}
      // Android composites fewer passes than iOS; more rounds keeps it smooth.
      blurRounds={8}
      overlayColor={overlayColor ? undefined : "rgba(11,9,5,0.35)"}
      style={style}
    >
      {overlayColor ? (
        <View
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, { backgroundColor: overlayColor }]}
        />
      ) : null}
      {children}
    </BlurView>
  );
}

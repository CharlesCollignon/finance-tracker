import { BlurView } from "@sbaiahmed1/react-native-blur";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import type { ReactNode } from "react";
import { isLightDesign } from "@finance/core/designs";

import { COLORS } from "@/theme/tokens";
import { currentDesign } from "@/theme/designs";

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
 * place. Dark on the dark designs, light on paper and grey.
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
  // Dark glass on the dark designs; on paper and grey a light one, tinted
  // with the design's own ground so a bar over them reads as that ground.
  const light = isLightDesign(currentDesign());
  return (
    <BlurView
      blurType={light ? "light" : "dark"}
      blurAmount={amount}
      // Android composites fewer passes than iOS; more rounds keeps it smooth.
      blurRounds={8}
      overlayColor={
        overlayColor ? undefined : light ? `${COLORS.background}99` : "rgba(11,9,5,0.35)"
      }
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

import { useEffect, useState } from "react";
import { View, type GestureResponderEvent } from "react-native";
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { useThemeColors } from "@/theme/useThemeColors";

/** The thumb's diameter; the track it rides on is the whole 48pt row. */
const THUMB = 28;
const TRACK = 6;

/**
 * A slider for an amount in steps: the "what if" of the year ahead.
 *
 * React Native has no slider of its own and the app takes none from the
 * community, so this is the smallest one that behaves: the whole 48pt row
 * takes the finger, the value snaps to its step, the scroll view cannot
 * steal a drag once it has started, and a screen reader adjusts it with the
 * system's swipe up and down like any native slider.
 */
export function ExtraSlider({
  value,
  max,
  step,
  onChange,
  label,
  valueText,
}: {
  value: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  label: string;
  /** The value in words, for a screen reader. */
  valueText: string;
}) {
  const colors = useThemeColors();
  const reduce = useReducedMotion();
  const [width, setWidth] = useState(0);
  const ratio = useSharedValue(value / max);

  useEffect(() => {
    ratio.value = reduce
      ? value / max
      : withTiming(value / max, { duration: 90 });
  }, [value, max, reduce, ratio]);

  const room = Math.max(0, width - THUMB);
  const thumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: ratio.value * room }],
  }));
  const fillStyle = useAnimatedStyle(() => ({
    width: ratio.value * room + THUMB / 2,
  }));

  function valueAt(event: GestureResponderEvent): number {
    if (room === 0) {
      return value;
    }
    const share = (event.nativeEvent.locationX - THUMB / 2) / room;
    const stepped = Math.round((share * max) / step) * step;
    return Math.min(max, Math.max(0, stepped));
  }

  function move(event: GestureResponderEvent) {
    const next = valueAt(event);
    if (next !== value) {
      onChange(next);
    }
  }

  return (
    <View
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max, now: value, text: valueText }}
      accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
      onAccessibilityAction={(event) => {
        const delta =
          event.nativeEvent.actionName === "increment" ? step : -step;
        onChange(Math.min(max, Math.max(0, value + delta)));
      }}
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
      onStartShouldSetResponder={() => true}
      onMoveShouldSetResponder={() => true}
      onResponderTerminationRequest={() => false}
      onResponderGrant={move}
      onResponderMove={move}
      style={{ height: 48, justifyContent: "center" }}
    >
      <View
        pointerEvents="none"
        style={{
          height: TRACK,
          marginHorizontal: 0,
          borderRadius: TRACK / 2,
          backgroundColor: colors.muted,
          overflow: "hidden",
        }}
      >
        <Animated.View
          style={[
            { height: TRACK, backgroundColor: colors.primary },
            fillStyle,
          ]}
        />
      </View>
      <Animated.View
        pointerEvents="none"
        style={[
          {
            position: "absolute",
            left: 0,
            width: THUMB,
            height: THUMB,
            borderRadius: THUMB / 2,
            backgroundColor: colors.foreground,
            borderWidth: 4,
            borderColor: colors.primary,
          },
          thumbStyle,
        ]}
      />
    </View>
  );
}

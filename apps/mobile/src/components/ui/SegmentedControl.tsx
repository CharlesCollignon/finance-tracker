import { useState } from "react";
import { Pressable, View, type LayoutChangeEvent } from "react-native";
import Animated, {
  useAnimatedStyle,
  useDerivedValue,
  withTiming,
} from "react-native-reanimated";

import { Text } from "@/components/ui/Text";
import { cn } from "@/lib/cn";
import { hapticSelection } from "@/lib/haptics";
import { useThemeColors } from "@/theme/useThemeColors";

export interface Segment<T extends string> {
  value: T;
  /** Two or three characters — "6M", "1Y", "All". */
  label: string;
  /** A range with nothing to draw is shown, not hidden: its absence is data. */
  disabled?: boolean;
}

interface SegmentedControlProps<T extends string> {
  segments: Segment<T>[];
  value: T;
  onChange: (next: T) => void;
  /** Names the set for a screen reader — "Chart range". */
  label: string;
  className?: string;
}

/**
 * The range picker, as one control rather than a row of buttons.
 *
 * The selection is a single pill that slides between positions instead of a
 * background appearing and disappearing per item: the movement is what says
 * the segments are one set of alternatives, and it costs one shared value.
 *
 * Ranges that cannot be drawn stay in place, dimmed. Removing them would make
 * the control change width as history accumulates, and a control that moves
 * under the thumb is worse than one with a greyed option in it.
 */
export function SegmentedControl<T extends string>({
  segments,
  value,
  onChange,
  label,
  className,
}: SegmentedControlProps<T>) {
  const colors = useThemeColors();
  const [width, setWidth] = useState(0);

  const index = Math.max(
    0,
    segments.findIndex((segment) => segment.value === value),
  );
  const slot = width > 0 ? width / segments.length : 0;

  // withTiming defaults to ReduceMotion.System, so the pill simply appears in
  // its new place when the user has asked for less motion.
  const offset = useDerivedValue(() =>
    withTiming(index * slot, { duration: 200 }),
  );
  const pill = useAnimatedStyle(() => ({
    transform: [{ translateX: offset.value }],
  }));

  function onLayout(event: LayoutChangeEvent) {
    setWidth(event.nativeEvent.layout.width);
  }

  return (
    <View
      accessibilityRole="tablist"
      accessibilityLabel={label}
      onLayout={onLayout}
      className={cn(
        "flex-row rounded-full border border-border p-1",
        className,
      )}
    >
      {slot > 0 ? (
        <Animated.View
          pointerEvents="none"
          style={[
            {
              position: "absolute",
              top: 4,
              bottom: 4,
              left: 4,
              width: slot - 8,
              borderRadius: 999,
              backgroundColor: colors.secondary,
            },
            pill,
          ]}
        />
      ) : null}

      {segments.map((segment) => {
        const selected = segment.value === value;
        return (
          <Pressable
            hitSlop={8}
            key={segment.value}
            accessibilityRole="tab"
            accessibilityLabel={segment.label}
            accessibilityState={{ selected, disabled: segment.disabled }}
            disabled={segment.disabled}
            onPress={() => {
              void hapticSelection();
              onChange(segment.value);
            }}
            className="flex-1 items-center justify-center py-1.5"
          >
            <Text
              variant="micro"
              numberOfLines={1}
              className={cn(
                "font-semibold",
                selected ? "text-foreground" : "text-muted-foreground",
                segment.disabled && "opacity-40",
              )}
            >
              {segment.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

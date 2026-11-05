import { useEffect, useState } from "react";
import { Pressable, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { ENTRY_KINDS } from "@finance/core/entry-draft";
import { DURATION, EASE_STANDARD } from "@finance/core/motion";
import type { CategoryType } from "@finance/core/types/database";

import { Text } from "@/components/ui/Text";
import { hapticSelection } from "@/lib/haptics";
import { useT } from "@/providers/LocaleProvider";
import { useThemeColors } from "@/theme/useThemeColors";

import { KIND_INK } from "./kind-ink";

const LABEL_KEY = {
  expense: "entry.kind.expense",
  income: "entry.kind.income",
  savings: "entry.kind.savings",
  investment: "entry.kind.investment",
} as const;

const EASING = Easing.bezier(...EASE_STANDARD);

/**
 * Dépense · Revenu · Épargne · Placement, the first thing the sheet asks.
 *
 * A raised pill under the chosen one follows the finger across, which is
 * press feedback rather than an arrival, and a dot in the kind's colour
 * says which colour the figure below is about to take.
 */
export function KindSwitch({
  value,
  onChange,
}: {
  value: CategoryType;
  onChange: (kind: CategoryType) => void;
}) {
  const t = useT();
  const colors = useThemeColors();
  const [width, setWidth] = useState(0);
  const segment = width / ENTRY_KINDS.length;
  const index = ENTRY_KINDS.indexOf(value);
  const offset = useSharedValue(0);

  useEffect(() => {
    offset.set(
      withTiming(index * segment, { duration: DURATION.enter, easing: EASING }),
    );
  }, [index, segment, offset]);

  const pill = useAnimatedStyle(() => ({
    transform: [{ translateX: offset.get() }],
  }));

  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={t("entry.kinds")}
      onLayout={(event) => setWidth(event.nativeEvent.layout.width - 6)}
      className="flex-row rounded-xl bg-foreground/5 p-[3px]"
    >
      {width > 0 ? (
        <Animated.View
          pointerEvents="none"
          style={[
            {
              position: "absolute",
              top: 3,
              bottom: 3,
              left: 3,
              width: segment,
              borderRadius: 9,
              backgroundColor: colors.secondary,
              borderWidth: 1,
              borderColor: colors.border,
            },
            pill,
          ]}
        />
      ) : null}
      {ENTRY_KINDS.map((kind) => {
        const selected = kind === value;
        return (
          <Pressable
            key={kind}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            onPress={() => {
              if (!selected) {
                void hapticSelection();
                onChange(kind);
              }
            }}
            className="h-9 flex-1 flex-row items-center justify-center gap-1.5"
          >
            {selected ? (
              <View
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: 3,
                  backgroundColor: colors[KIND_INK[kind]],
                }}
              />
            ) : null}
            <Text
              numberOfLines={1}
              className={
                selected
                  ? "text-[13px] font-medium text-foreground"
                  : "text-[13px] font-medium text-muted-foreground"
              }
            >
              {t(LABEL_KEY[kind])}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

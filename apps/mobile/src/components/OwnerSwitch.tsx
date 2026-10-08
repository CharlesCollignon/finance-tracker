import { useState } from "react";
import { Pressable, View, type LayoutChangeEvent } from "react-native";
import Animated, {
  useAnimatedStyle,
  useDerivedValue,
  withSpring,
} from "react-native-reanimated";

import { Text } from "@/components/ui/Text";
import { cn } from "@/lib/cn";
import { useT } from "@/providers/LocaleProvider";
import { useOwner } from "@/providers/OwnerProvider";
import { useThemeColors } from "@/theme/useThemeColors";
import { RADIUS } from "@/theme/tokens";

/** The thumb's spring: quick, with the least overshoot that still reads. */
const THUMB_SPRING = { damping: 20, stiffness: 320, mass: 0.7 };

/** The initials' spring: a little looser, so they meet after the thumb. */
const MEET_SPRING = { damping: 12, stiffness: 240 };

/**
 * « Moi · Commun », in the header of the shared screens: whose money they
 * show. The web's twin is `components/layout/OwnerSwitch.tsx`.
 *
 * One thumb slides between the two, sized to each label as it goes, and
 * under « Commun » the partners' initials close in on each other. Springs
 * follow the system's reduce-motion setting, landing without the travel.
 */
export function OwnerSwitch() {
  const t = useT();
  const colors = useThemeColors();
  const { space, joint, setJoint } = useOwner();
  const [slots, setSlots] = useState<{ x: number; width: number }[]>([]);

  const slot = slots[joint ? 1 : 0];
  const x = useDerivedValue(() => withSpring(slot?.x ?? 0, THUMB_SPRING));
  const width = useDerivedValue(() =>
    withSpring(slot?.width ?? 0, THUMB_SPRING),
  );
  const thumb = useAnimatedStyle(() => ({
    width: width.get(),
    transform: [{ translateX: x.get() }],
  }));

  if (!space) {
    return null;
  }

  function measure(index: number) {
    return (event: LayoutChangeEvent) => {
      const { x: left, width: size } = event.nativeEvent.layout;
      setSlots((current) => {
        const next = [...current];
        next[index] = { x: left, width: size };
        return next;
      });
    };
  }

  const options = [
    { joint: false, label: t("space.mine") },
    { joint: true, label: space.name },
  ];

  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={t("space.switchLabel")}
      className="flex-row items-center rounded-full border border-border p-0.5"
      style={{ backgroundColor: colors.muted }}
    >
      {slot ? (
        <Animated.View
          pointerEvents="none"
          style={[
            {
              position: "absolute",
              top: 2,
              bottom: 2,
              left: 0,
              borderRadius: RADIUS.pill,
              backgroundColor: colors.background,
              borderWidth: 1,
              borderColor: colors.border,
            },
            thumb,
          ]}
        />
      ) : null}
      {options.map((option, index) => {
        const selected = option.joint === joint;
        return (
          <Pressable
            key={String(option.joint)}
            hitSlop={6}
            accessibilityRole="radio"
            accessibilityLabel={option.label}
            accessibilityState={{ checked: selected }}
            onLayout={measure(index)}
            onPress={() => {
              if (!selected) {
                setJoint(option.joint);
              }
            }}
            className="h-8 flex-row items-center gap-1.5 px-3"
          >
            {option.joint ? (
              <Initials
                names={space.members.map((member) => member.name)}
                together={joint}
              />
            ) : null}
            <Text
              variant="micro"
              numberOfLines={1}
              className={cn(
                "max-w-28 font-semibold",
                selected ? "text-foreground" : "text-muted-foreground",
              )}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Two small discs that move together when the space is the one on screen. */
function Initials({
  names,
  together,
}: {
  names: string[];
  together: boolean;
}) {
  const colors = useThemeColors();
  const shift = useDerivedValue(() =>
    withSpring(together ? -5 : -1, MEET_SPRING),
  );
  const second = useAnimatedStyle(() => ({
    transform: [{ translateX: shift.get() }],
  }));

  return (
    <View className="flex-row items-center" importantForAccessibility="no">
      {names.slice(0, 2).map((name, index) => (
        <Animated.View
          key={`${index}-${name}`}
          style={[
            {
              width: 16,
              height: 16,
              borderRadius: 8,
              borderWidth: 1,
              borderColor: colors.background,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor:
                index === 0 ? colors.foreground : colors.mutedForeground,
            },
            index === 1 ? second : null,
          ]}
        >
          <Text
            style={{ fontSize: 8, lineHeight: 10, color: colors.background }}
            className="font-semibold"
          >
            {(name.trim()[0] ?? "?").toUpperCase()}
          </Text>
        </Animated.View>
      ))}
    </View>
  );
}

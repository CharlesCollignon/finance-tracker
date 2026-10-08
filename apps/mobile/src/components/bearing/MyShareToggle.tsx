import { Pressable, View } from "react-native";
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

/** The knob's spring: a flick, settled. */
const KNOB_SPRING = { damping: 18, stiffness: 420 };

/**
 * « Avec ma part du commun » (6b), small enough for a card's header: the
 * knob flicks across and Le point counts the person's part of their shared
 * space, or stops. The web's twin is `MyShareToggle.tsx` beside the Bearing.
 */
export function MyShareToggle() {
  const t = useT();
  const colors = useThemeColors();
  const { myShare, setMyShare } = useOwner();
  const x = useDerivedValue(() => withSpring(myShare ? 12 : 0, KNOB_SPRING));
  const knob = useAnimatedStyle(() => ({
    transform: [{ translateX: x.get() }],
  }));

  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={t("space.myShare")}
      accessibilityState={{ checked: myShare }}
      hitSlop={8}
      onPress={() => setMyShare(!myShare)}
      className="flex-row items-center gap-2 rounded-full px-2 py-1"
    >
      <Text
        className={cn(
          "text-xs font-medium",
          myShare ? "text-foreground" : "text-muted-foreground",
        )}
        numberOfLines={1}
      >
        {t("space.myShare")}
      </Text>
      <View
        className="h-4 w-7 justify-center rounded-full px-0.5"
        style={{
          backgroundColor: myShare ? colors.foreground : colors.border,
        }}
      >
        <Animated.View
          style={[
            {
              width: 12,
              height: 12,
              borderRadius: 6,
              backgroundColor: colors.background,
            },
            knob,
          ]}
        />
      </View>
    </Pressable>
  );
}

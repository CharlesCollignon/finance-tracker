import { useState } from "react";
import { View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useDerivedValue,
  withSpring,
} from "react-native-reanimated";

import { Button } from "@/components/ui/Button";
import { Text } from "@/components/ui/Text";
import { hapticSelection } from "@/lib/haptics";
import { useT } from "@/providers/LocaleProvider";
import { useThemeColors } from "@/theme/useThemeColors";

/** A part as a whole percent: « 60 % ». */
export function percent(part: number): string {
  return `${Math.round(part * 100)}\u00A0%`;
}

/** One step of the split: five points either way. */
const SHARE_STEP = 0.05;

/**
 * A split between the two partners, set a step at a time: the bar between
 * them springs to it, each side named and counted, and one press saves it
 * for both. The space's split of the spending (6b) and a home's deed (6c).
 * The web's twin is `components/space/SplitEditor.tsx`.
 */
export function SplitEditor({
  initial,
  partnerName,
  hint,
  pending,
  onSave,
}: {
  initial: number;
  partnerName: string;
  /** The one sentence saying what this split is for. */
  hint: string;
  pending: boolean;
  onSave: (share: number) => void;
}) {
  const t = useT();
  const colors = useThemeColors();
  const [share, setShare] = useState(Math.round(initial * 20) / 20);
  const width = useDerivedValue(() =>
    withSpring(share * 100, { damping: 16, stiffness: 220 }),
  );
  const mine = useAnimatedStyle(() => ({ width: `${width.get()}%` }));

  function step(by: number) {
    const next = Math.round(Math.min(1, Math.max(0, share + by)) * 20) / 20;
    if (next !== share) {
      void hapticSelection();
      setShare(next);
    }
  }

  return (
    <View className="gap-3">
      <Text variant="micro">{hint}</Text>
      <View className="flex-row items-baseline justify-between">
        <Text className="text-sm font-medium">
          {t("space.shareYou", { part: percent(share) })}
        </Text>
        <Text variant="muted" className="text-sm">
          {t("space.sharePartner", {
            name: partnerName,
            part: percent(1 - share),
          })}
        </Text>
      </View>
      <View className="flex-row items-center gap-3">
        <Button
          label="−"
          variant="outline"
          size="sm"
          accessibilityLabel={t("space.shareLess")}
          disabled={share <= 0}
          onPress={() => step(-SHARE_STEP)}
        />
        <View
          className="h-2 flex-1 overflow-hidden rounded-full"
          style={{ backgroundColor: colors.muted }}
        >
          <Animated.View
            style={[
              { height: "100%", backgroundColor: colors.foreground },
              mine,
            ]}
          />
        </View>
        <Button
          label="+"
          variant="outline"
          size="sm"
          accessibilityLabel={t("space.shareMore")}
          disabled={share >= 1}
          onPress={() => step(SHARE_STEP)}
        />
      </View>
      <Button
        label={pending ? t("profile.saving") : t("profile.save")}
        disabled={pending || share === initial}
        onPress={() => onSave(share)}
      />
    </View>
  );
}

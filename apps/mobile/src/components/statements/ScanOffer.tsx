import { useEffect } from "react";
import { View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Animated, {
  cancelAnimation,
  Easing,
  FadeInDown,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
  ZoomIn,
} from "react-native-reanimated";

import { DURATION } from "@finance/core/motion";

import { ConnectAiInvite } from "@/components/ConnectAiInvite";
import { Button } from "@/components/ui/Button";
import { Text } from "@/components/ui/Text";
import { useT } from "@/providers/LocaleProvider";
import { ICON } from "@/theme/tokens";
import { useThemeColors } from "@/theme/useThemeColors";

/** The page's height the reading line travels, in points. */
const PAGE = 64;

/** A page being read: a line going down it and back, still under reduced motion. */
function Reading() {
  const colors = useThemeColors();
  const reduceMotion = useReducedMotion();
  const at = useSharedValue(0);
  useEffect(() => {
    if (reduceMotion) {
      return;
    }
    at.value = withRepeat(withTiming(1, { duration: 1200, easing: Easing.inOut(Easing.quad) }), -1, true);
    return () => cancelAnimation(at);
  }, [at, reduceMotion]);
  const line = useAnimatedStyle(() => ({ transform: [{ translateY: 8 + at.value * (PAGE - 16) }] }));

  return (
    <View className="h-20 w-20 items-center justify-center overflow-hidden rounded-card bg-muted">
      <Ionicons name="document-text-outline" size={40} color={colors.mutedForeground} />
      <Animated.View
        style={[{ position: "absolute", top: 0, left: 8, right: 8, height: 2, borderRadius: 1, backgroundColor: colors.primary }, line]}
      />
    </View>
  );
}

/**
 * A statement Pluclair cannot take the text out of — a scan, a photo, a
 * screenshot, a PDF it did not recognise — and the offer to have the
 * person's own AI account read it with Mistral: what is sent where, and
 * kept by no one, said before the one button that sends it, for this file
 * only. Without an AI account, the way to connect one. The web's twin is
 * `components/finance/statements/ScanOffer.tsx`.
 */
export function ScanOffer({
  reason,
  aiAccount,
  scanning,
  onScan,
}: {
  reason: string;
  aiAccount: boolean;
  scanning: boolean;
  onScan: () => void;
}) {
  const t = useT();
  const colors = useThemeColors();
  const reduceMotion = useReducedMotion();

  if (scanning) {
    return (
      <View accessibilityRole="progressbar" accessibilityLabel={t("statements.scanning")} className="items-center gap-4 py-4">
        <Reading />
        <View className="items-center gap-1">
          <Text className="font-medium">{t("statements.scanning")}</Text>
          <Text variant="muted" className="text-center">
            {t("statements.scanningHint")}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View className="gap-4">
      <View className="flex-row items-start gap-2">
        <Ionicons name="alert-circle-outline" size={ICON.lg} color={colors.foreground} />
        <Text className="flex-1 text-sm leading-5">{reason}</Text>
      </View>
      {aiAccount ? (
        <Animated.View
          entering={reduceMotion ? undefined : FadeInDown.duration(DURATION.panel)}
          className="gap-3 rounded-control border border-primary/30 bg-accent p-4"
        >
          <View className="flex-row items-center gap-2">
            <Animated.View entering={reduceMotion ? undefined : ZoomIn.springify().damping(12)}>
              <Ionicons name="sparkles" size={ICON.md} color={colors.primary} />
            </Animated.View>
            <Text variant="head" className="flex-1">
              {t("statements.scanTitle")}
            </Text>
          </View>
          <Text className="text-sm leading-5">{t("statements.scanBody")}</Text>
          <Text variant="micro">{t("statements.scanCost")}</Text>
          <Button label={t("statements.scanGo")} icon="sparkles" onPress={onScan} />
        </Animated.View>
      ) : (
        <View className="gap-2">
          <Text variant="muted" className="leading-5">
            {t("statements.scanNoAccountBody")}
          </Text>
          <ConnectAiInvite />
        </View>
      )}
    </View>
  );
}

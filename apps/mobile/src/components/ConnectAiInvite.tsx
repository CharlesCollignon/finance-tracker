import { Pressable, View } from "react-native";
import { type Href, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeInDown, FadeInLeft, ZoomIn } from "react-native-reanimated";

import { Button } from "@/components/ui/Button";
import { Text } from "@/components/ui/Text";
import { cn } from "@/lib/cn";
import { hapticLight } from "@/lib/haptics";
import { useT } from "@/providers/LocaleProvider";
import { ICON } from "@/theme/tokens";
import { useThemeColors } from "@/theme/useThemeColors";

/** Where the invitation leads: Profile, with the connect row open. */
const CONNECT_HREF = "/profile?ai=connect";

const STEPS = [
  { title: "aiAccount.step1Title", body: "aiAccount.step1Body" },
  { title: "aiAccount.step2Title", body: "aiAccount.step2Body" },
  { title: "aiAccount.step3Title", body: "aiAccount.step3Body" },
] as const;

/**
 * The three steps to having an AI write in Pluclair — an OpenRouter account,
 * a few euros of credit there, a model — each arriving in turn. The web's
 * twin is `AiSetupSteps` in `components/finance/ConnectAiInvite.tsx`.
 */
export function AiSetupSteps() {
  const t = useT();
  return (
    <View className="gap-3">
      {STEPS.map((step, index) => (
        <Animated.View
          key={step.title}
          entering={FadeInLeft.delay(80 * index).duration(300)}
          className="flex-row items-start gap-3"
        >
          <View className="h-6 w-6 items-center justify-center rounded-full bg-muted">
            <Text className="text-xs font-semibold">{index + 1}</Text>
          </View>
          <View className="min-w-0 flex-1">
            <Text className="text-sm font-medium">{t(step.title)}</Text>
            <Text variant="micro">{t(step.body)}</Text>
          </View>
        </Animated.View>
      ))}
    </View>
  );
}

/**
 * Where an AI would write, for someone with no AI account connected: the
 * way to connect one. `card` where the read or the questions would be;
 * `line` beside other controls. The web's twin is `ConnectAiInvite`.
 */
export function ConnectAiInvite({
  variant = "line",
  bare = false,
}: {
  variant?: "line" | "card";
  /** A card inside a card: no border and no padding of its own. */
  bare?: boolean;
}) {
  const t = useT();
  const router = useRouter();
  const colors = useThemeColors();
  const go = () => {
    void hapticLight();
    router.push(CONNECT_HREF as Href);
  };

  if (variant === "line") {
    return (
      <Pressable
        accessibilityRole="link"
        hitSlop={8}
        onPress={go}
        className="flex-row items-center gap-1.5"
      >
        <Ionicons
          name="sparkles-outline"
          size={ICON.md}
          color={colors.mutedForeground}
        />
        <Text variant="muted" className="font-medium">
          {t("aiAccount.connectFirst")}
        </Text>
      </Pressable>
    );
  }

  return (
    <Animated.View
      entering={FadeInDown.springify().damping(18)}
      className={cn(
        "gap-4",
        !bare && "rounded-card border border-border bg-card/70 p-card",
      )}
    >
      <View className="flex-row items-start gap-3">
        <Animated.View
          entering={ZoomIn.springify().damping(12)}
          className="h-10 w-10 items-center justify-center rounded-full bg-muted"
        >
          <Ionicons name="sparkles" size={ICON.lg} color={colors.foreground} />
        </Animated.View>
        <View className="min-w-0 flex-1">
          <Text variant="head">{t("aiAccount.ctaTitle")}</Text>
          <Text variant="muted">{t("aiAccount.ctaBody")}</Text>
        </View>
      </View>
      <AiSetupSteps />
      <Button
        variant="pill"
        icon="arrow-forward"
        label={t("aiAccount.ctaButton")}
        onPress={go}
      />
    </Animated.View>
  );
}

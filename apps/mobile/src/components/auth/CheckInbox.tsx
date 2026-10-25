import { Link } from "expo-router";
import { useEffect, useState } from "react";
import { AccessibilityInfo, Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Animated from "react-native-reanimated";

import { Orb } from "@/components/Orb";
import { Blur } from "@/components/ui/Blur";
import { Button } from "@/components/ui/Button";
import { Screen } from "@/components/ui/Screen";
import { Text } from "@/components/ui/Text";
import { hapticSuccess } from "@/lib/haptics";
import { useAuth } from "@/providers/AuthProvider";
import { useT } from "@/providers/LocaleProvider";
import { ICON, RADIUS } from "@/theme/tokens";
import { useThemeColors } from "@/theme/useThemeColors";
import { resolveMessage } from "@finance/core/i18n/t";
import { FADE_IN, FADE_OUT } from "@/components/motion/fade";

/**
 * Seconds before « Renvoyer » can be pressed: Supabase sends at most one
 * confirmation a minute to an address, so the button waits as long as the
 * server would.
 */
const RESEND_COOLDOWN_S = 60;

/**
 * What a sign-up turns into when the account waits for its address — the
 * phone's twin of the web's `CheckInbox`.
 *
 * Before, the sentence asking to open the e-mail showed in red under the
 * form, where an error goes. This replaces the form: the address the link
 * went to, where to look, a way to have it sent again, and a way back when
 * the address was mistyped. The link opens in the browser, so the screen
 * also says to come back here to sign in.
 */
export function CheckInbox({
  email,
  onChangeAddress,
}: {
  email: string;
  onChangeAddress: () => void;
}) {
  const t = useT();
  const colors = useThemeColors();
  const { resendConfirmation } = useAuth();
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN_S);
  const [pending, setPending] = useState(false);
  const [sends, setSends] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (cooldown <= 0) {
      return;
    }
    const tick = setTimeout(() => setCooldown((left) => left - 1), 1000);
    return () => clearTimeout(tick);
  }, [cooldown]);

  async function resend() {
    setPending(true);
    setError(null);
    const result = await resendConfirmation(email);
    setPending(false);
    if (result.error) {
      setError(result.error);
      AccessibilityInfo.announceForAccessibility(
        resolveMessage(t, result.error),
      );
      return;
    }
    void hapticSuccess();
    setSends((count) => count + 1);
    setCooldown(RESEND_COOLDOWN_S);
    AccessibilityInfo.announceForAccessibility(t("auth.confirmationResent"));
  }

  return (
    <Screen showPrivacyToggle={false} showAccountMenu={false} showLogo={false}>
      <View className="flex-1 justify-center">
        <View className="items-center gap-3 pb-8">
          <Orb size="login" />
          <Text className="font-logo text-4xl text-foreground">Pluclair</Text>
        </View>

        <Blur
          style={{
            borderRadius: RADIUS.card,
            overflow: "hidden",
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: colors.border,
          }}
        >
          <Animated.View
            entering={FADE_IN}
            className="items-center gap-4 p-5"
          >
            <View className="h-20 w-20 items-center justify-center rounded-full border border-primary/30 bg-accent">
              {/* Keyed by the sends: each mail sent again flies the
                  envelope off and lands a new one. */}
              <Animated.View
                key={sends}
                entering={FADE_IN}
                exiting={FADE_OUT}
                className="absolute"
              >
                <Ionicons
                  name="mail-outline"
                  size={36}
                  color={colors.primary}
                />
              </Animated.View>
            </View>

            <Text
              accessibilityRole="header"
              className="text-center text-2xl font-bold"
            >
              {t("auth.checkInboxHeading")}
            </Text>
            <Text className="text-center text-muted-foreground">
              {t("auth.checkInboxBody", { email })}
            </Text>
            <Text className="text-center text-muted-foreground">
              {t("auth.checkInboxThenSignIn")}
            </Text>
            <Text variant="muted" className="text-center">
              {t("auth.checkInboxSpam")}
            </Text>

            <View className="w-full">
              <Button
                variant="outline"
                label={
                  pending
                    ? t("auth.resendingConfirmation")
                    : cooldown > 0
                      ? t("auth.resendIn", { seconds: cooldown })
                      : t("auth.resendConfirmation")
                }
                disabled={pending || cooldown > 0}
                onPress={() => void resend()}
              />
            </View>

            {error ? (
              <Text
                accessibilityRole="alert"
                className="text-center text-destructive"
              >
                {resolveMessage(t, error)}
              </Text>
            ) : sends > 0 ? (
              <Animated.View
                key={`sent-${sends}`}
                entering={FADE_IN}
                className="flex-row items-center justify-center gap-1.5"
              >
                <Ionicons
                  name="checkmark-circle"
                  size={ICON.md}
                  color={colors.primary}
                />
                <Text variant="muted">{t("auth.confirmationResent")}</Text>
              </Animated.View>
            ) : null}

            <View className="items-center">
              <View className="flex-row items-center gap-1">
                <Text variant="muted">{t("auth.wrongAddress")}</Text>
                <Pressable
                  accessibilityRole="button"
                  hitSlop={8}
                  onPress={onChangeAddress}
                  className="min-h-11 justify-center"
                >
                  <Text className="font-bold underline">
                    {t("auth.changeAddress")}
                  </Text>
                </Pressable>
              </View>
              <View className="flex-row items-center gap-1">
                <Text variant="muted">{t("auth.alreadyConfirmed")}</Text>
                <Link href="/login" asChild>
                  <Pressable
                    accessibilityRole="link"
                    hitSlop={8}
                    className="min-h-11 justify-center"
                  >
                    <Text className="font-bold underline">
                      {t("auth.signIn")}
                    </Text>
                  </Pressable>
                </Link>
              </View>
            </View>
          </Animated.View>
        </Blur>
      </View>
    </Screen>
  );
}

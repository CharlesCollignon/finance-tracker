import { Link } from "expo-router";
import { useState } from "react";
import {
  AccessibilityInfo,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from "react-native";

import { Orb } from "@/components/Orb";
import { Blur } from "@/components/ui/Blur";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Screen } from "@/components/ui/Screen";
import { Text } from "@/components/ui/Text";
import { useAuth } from "@/providers/AuthProvider";
import { useT } from "@/providers/LocaleProvider";
import { RADIUS } from "@/theme/tokens";
import { useThemeColors } from "@/theme/useThemeColors";
import { resolveMessage } from "@finance/core/i18n/t";
import { resetRequestSchema } from "@finance/core/validations/finance";

/**
 * Asking for a way back in, on the phone.
 *
 * The same neutral confirmation as the web whether or not the address has an
 * account, so the form cannot be used to learn who is registered. The new
 * password is chosen on the web page the email opens; this screen says so.
 */
export default function ResetScreen() {
  const t = useT();
  const colors = useThemeColors();
  const { requestPasswordReset } = useAuth();
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);

  async function send() {
    setMessage(null);
    const parsed = resetRequestSchema.safeParse({ email });
    if (!parsed.success) {
      const key = parsed.error.issues[0]?.message ?? "errors.invalidInput";
      setMessage(key);
      // iOS has no live-region equivalent for the error text below, so it is
      // announced explicitly; Android already speaks it via the live region.
      AccessibilityInfo.announceForAccessibility(resolveMessage(t, key));
      return;
    }
    setPending(true);
    const result = await requestPasswordReset(parsed.data.email);
    setPending(false);
    if (result.error) {
      setMessage(result.error);
      AccessibilityInfo.announceForAccessibility(
        resolveMessage(t, result.error),
      );
      return;
    }
    setSentTo(parsed.data.email);
    AccessibilityInfo.announceForAccessibility(
      `${t("auth.resetSent", { email: parsed.data.email })} ${t("auth.resetFinishOnWeb")}`,
    );
  }

  return (
    <Screen showPrivacyToggle={false} showAccountMenu={false} showLogo={false}>
      <KeyboardAvoidingView
        className="flex-1 justify-center"
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
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
          <View className="items-stretch gap-4 p-5">
            <Text
              accessibilityRole="header"
              className="text-center text-2xl font-bold"
            >
              {t("auth.resetHeading")}
            </Text>

            {sentTo ? (
              <View className="gap-3">
                <Text
                  accessibilityLiveRegion="polite"
                  className="text-center text-muted-foreground"
                >
                  {t("auth.resetSent", { email: sentTo })}
                </Text>
                <Text className="text-center text-muted-foreground">
                  {t("auth.resetFinishOnWeb")}
                </Text>
              </View>
            ) : (
              <>
                <Text className="text-center text-muted-foreground">
                  {t("auth.resetBody")}
                </Text>
                <View className="gap-1.5">
                  <Text variant="label">{t("auth.email")}</Text>
                  <Input
                    accessibilityLabel={t("auth.emailAddress")}
                    placeholder="you@example.com"
                    autoCapitalize="none"
                    autoComplete="email"
                    textContentType="emailAddress"
                    keyboardType="email-address"
                    returnKeyType="send"
                    onSubmitEditing={() => void send()}
                    invalid={message !== null}
                    value={email}
                    onChangeText={setEmail}
                  />
                </View>
                {message ? (
                  <Text
                    accessibilityRole="alert"
                    accessibilityLiveRegion="polite"
                    className="text-center text-destructive"
                  >
                    {resolveMessage(t, message)}
                  </Text>
                ) : null}
                <Button
                  label={
                    pending
                      ? t("auth.sendingResetLink")
                      : t("auth.sendResetLink")
                  }
                  disabled={pending || !email}
                  onPress={send}
                />
              </>
            )}

            <View className="flex-row justify-center">
              <Link href="/login" asChild>
                <Pressable
                  accessibilityRole="link"
                  hitSlop={8}
                  className="min-h-11 justify-center"
                >
                  <Text className="font-bold underline">
                    {t("auth.backToSignIn")}
                  </Text>
                </Pressable>
              </Link>
            </View>
          </View>
        </Blur>
      </KeyboardAvoidingView>
    </Screen>
  );
}

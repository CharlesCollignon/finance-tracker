import { Link, type Href } from "expo-router";
import { useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { Orb } from "@/components/Orb";
import { Button } from "@/components/ui/Button";
import { Blur } from "@/components/ui/Blur";
import { Input } from "@/components/ui/Input";
import { Screen } from "@/components/ui/Screen";
import { Text } from "@/components/ui/Text";
import { ICON } from "@/theme/tokens";
import { useThemeColors } from "@/theme/useThemeColors";
import { validateAuthInput } from "@/lib/mutations";
import { useAuth } from "@/providers/AuthProvider";
import { useT } from "@/providers/LocaleProvider";
import { resolveMessage } from "@finance/core/i18n/t";

export interface AuthFormProps {
  title: string;
  submitLabel: string;
  onSubmit: (email: string, password: string) => Promise<{ error?: string }>;
  footerPrompt: string;
  footerLinkLabel: string;
  footerHref: Href;
  showPasskey?: boolean;
  /**
   * Signup rather than sign-in. Drives the password field's autofill contract:
   * a manager should offer to generate here and to fill everywhere else.
   */
  newPassword?: boolean;
}

export function AuthForm({
  title,
  submitLabel,
  onSubmit,
  footerPrompt,
  footerLinkLabel,
  footerHref,
  showPasskey = false,
  newPassword = false,
}: AuthFormProps) {
  const t = useT();
  const { signInWithGoogle, signInWithPasskey } = useAuth();
  const colors = useThemeColors();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [reveal, setReveal] = useState(false);
  /** Which field the message belongs to, so the error shows at the field. */
  const [badField, setBadField] = useState<"email" | "password" | null>(null);
  const passwordRef = useRef<TextInput>(null);

  async function handleSubmit() {
    setMessage(null);
    setBadField(null);
    const parsed = validateAuthInput(email.trim(), password);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      setMessage(issue?.message ?? t("auth.invalidCredentials"));
      // The schema names the field it rejected; anything else is a credential
      // failure the server reports, which belongs to neither field alone.
      const field = issue?.path[0];
      setBadField(field === "email" || field === "password" ? field : null);
      return;
    }
    setSubmitting(true);
    const { error } = await onSubmit(parsed.data.email, parsed.data.password);
    setSubmitting(false);
    if (error) {
      setMessage(error);
    }
  }

  async function handleGoogle() {
    setMessage(null);
    setBadField(null);
    setSubmitting(true);
    const { error } = await signInWithGoogle();
    setSubmitting(false);
    if (error) {
      setMessage(error);
    }
  }

  async function handlePasskey() {
    setMessage(null);
    setBadField(null);
    setSubmitting(true);
    const { error } = await signInWithPasskey();
    setSubmitting(false);
    if (error) {
      setMessage(error);
    }
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
            borderRadius: 24,
            overflow: "hidden",
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: colors.border,
          }}
        >
          <View className="items-stretch gap-4 p-5">
            <Text className="text-center text-2xl font-bold">{title}</Text>
            <View className="gap-1.5">
              <Text variant="label">{t("auth.email")}</Text>
              <Input
                accessibilityLabel={t("auth.emailAddress")}
                placeholder="you@example.com"
                autoCapitalize="none"
                autoComplete="email"
                textContentType="emailAddress"
                keyboardType="email-address"
                returnKeyType="next"
                submitBehavior="submit"
                onSubmitEditing={() => passwordRef.current?.focus()}
                invalid={badField === "email"}
                value={email}
                onChangeText={setEmail}
              />
            </View>

            <View className="gap-1.5">
              <Text variant="label">{t("auth.password")}</Text>
              <View className="flex-row items-center gap-2">
                {/*
                  Wrapped rather than given flex-1 directly: Input carries
                  w-full, and a plain class joiner would leave both on the same
                  element for Yoga to reconcile.
                */}
                <View className="flex-1">
                  <Input
                    ref={passwordRef}
                    accessibilityLabel={t("auth.password")}
                    placeholder={t("auth.passwordPlaceholder")}
                    secureTextEntry={!reveal}
                    autoCapitalize="none"
                    autoComplete={
                      newPassword ? "new-password" : "current-password"
                    }
                    textContentType={newPassword ? "newPassword" : "password"}
                    returnKeyType="go"
                    onSubmitEditing={() => void handleSubmit()}
                    invalid={badField === "password"}
                    value={password}
                    onChangeText={setPassword}
                  />
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={
                    reveal ? t("auth.hidePassword") : t("auth.showPassword")
                  }
                  accessibilityState={{ selected: reveal }}
                  hitSlop={8}
                  onPress={() => setReveal((value) => !value)}
                  className="h-12 w-12 items-center justify-center rounded-md border border-border"
                >
                  <Ionicons
                    name={reveal ? "eye-off-outline" : "eye-outline"}
                    size={ICON.xl}
                    color={colors.mutedForeground}
                  />
                </Pressable>
              </View>
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
              label={submitting ? t("auth.pleaseWait") : submitLabel}
              disabled={submitting || !email || !password}
              onPress={handleSubmit}
            />

            <Button
              label={t("auth.withGoogleContinue")}
              variant="outline"
              disabled={submitting}
              onPress={handleGoogle}
            />

            {showPasskey ? (
              <Button
                label={t("auth.withPasskey")}
                variant="outline"
                disabled={submitting}
                onPress={handlePasskey}
              />
            ) : null}

            <View className="flex-row justify-center gap-1">
              <Text variant="muted">{footerPrompt}</Text>
              <Link href={footerHref}>
                <Text className="font-bold underline">{footerLinkLabel}</Text>
              </Link>
            </View>
          </View>
        </Blur>
      </KeyboardAvoidingView>
    </Screen>
  );
}

import { Link, type Href } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, StyleSheet, View } from "react-native";

import { Orb } from "@/components/Orb";
import { Button } from "@/components/ui/Button";
import { Blur } from "@/components/ui/Blur";
import { Input } from "@/components/ui/Input";
import { Screen } from "@/components/ui/Screen";
import { Text } from "@/components/ui/Text";
import { useThemeColors } from "@/theme/useThemeColors";
import { validateAuthInput } from "@/lib/mutations";
import { useAuth } from "@/providers/AuthProvider";

export interface AuthFormProps {
  title: string;
  submitLabel: string;
  onSubmit: (email: string, password: string) => Promise<{ error?: string }>;
  footerPrompt: string;
  footerLinkLabel: string;
  footerHref: Href;
  showPasskey?: boolean;
}

export function AuthForm({
  title,
  submitLabel,
  onSubmit,
  footerPrompt,
  footerLinkLabel,
  footerHref,
  showPasskey = false,
}: AuthFormProps) {
  const { signInWithGoogle, signInWithPasskey } = useAuth();
  const colors = useThemeColors();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    setMessage(null);
    const parsed = validateAuthInput(email.trim(), password);
    if (!parsed.success) {
      setMessage(parsed.error.issues[0]?.message ?? "Invalid credentials");
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
    setSubmitting(true);
    const { error } = await signInWithGoogle();
    setSubmitting(false);
    if (error) {
      setMessage(error);
    }
  }

  async function handlePasskey() {
    setMessage(null);
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
          <Orb size="login" spin="drift" />
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
            <Input
              placeholder="Email"
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
            />
            <Input
              placeholder="Password"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
            />

            {message ? (
              <Text className="text-center text-destructive">{message}</Text>
            ) : null}

            <Button
              label={submitting ? "Please wait..." : submitLabel}
              disabled={submitting || !email || !password}
              onPress={handleSubmit}
            />

            <Button
              label="Continue with Google"
              variant="outline"
              disabled={submitting}
              onPress={handleGoogle}
            />

            {showPasskey ? (
              <Button
                label="Sign in with passkey"
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

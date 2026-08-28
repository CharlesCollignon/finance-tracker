import { Link, type Href } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, View } from "react-native";

import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Screen } from "@/components/ui/Screen";
import { Text } from "@/components/ui/Text";
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
    <Screen title={title} showPrivacyToggle={false} showAccountMenu={false}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View className="mb-6 items-center">
          <Logo size="hero" />
        </View>
        <Card bezel innerClassName="gap-4 p-5">
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

          {message ? <Text className="text-destructive">{message}</Text> : null}

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

          <View className="flex-row gap-1">
            <Text variant="muted">{footerPrompt}</Text>
            <Link href={footerHref}>
              <Text className="font-bold underline">{footerLinkLabel}</Text>
            </Link>
          </View>
        </Card>
      </KeyboardAvoidingView>
    </Screen>
  );
}

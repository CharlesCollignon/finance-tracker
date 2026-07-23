import { Link, type Href } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, View } from "react-native";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Screen } from "@/components/ui/Screen";
import { Text } from "@/components/ui/Text";

export interface AuthFormProps {
  title: string;
  submitLabel: string;
  onSubmit: (email: string, password: string) => Promise<{ error?: string }>;
  footerPrompt: string;
  footerLinkLabel: string;
  footerHref: Href;
}

export function AuthForm({
  title,
  submitLabel,
  onSubmit,
  footerPrompt,
  footerLinkLabel,
  footerHref,
}: AuthFormProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    setMessage(null);
    setSubmitting(true);
    const { error } = await onSubmit(email.trim(), password);
    setSubmitting(false);
    if (error) {
      setMessage(error);
    }
  }

  return (
    <Screen title={title}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View className="gap-4">
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
            <Text className="text-destructive">{message}</Text>
          ) : null}

          <Button
            label={submitting ? "Please wait..." : submitLabel}
            disabled={submitting || !email || !password}
            onPress={handleSubmit}
          />

          <View className="flex-row gap-1">
            <Text variant="muted">{footerPrompt}</Text>
            <Link href={footerHref}>
              <Text className="font-bold underline">{footerLinkLabel}</Text>
            </Link>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

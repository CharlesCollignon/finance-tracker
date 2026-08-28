import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";

import { Text } from "@/components/ui/Text";
import { useAuth } from "@/providers/AuthProvider";

/** Long enough to cover a slow token exchange, short enough not to strand. */
const EXCHANGE_TIMEOUT_MS = 12_000;

/**
 * Landing route for the OAuth redirect (pluclair://auth/callback).
 *
 * Expo Router resolves that deep link as a path, so without a route here it
 * rendered "Unmatched Route" after a Google sign-in. AuthProvider still owns
 * the code exchange — this screen only holds the user while it completes and
 * then hands them on.
 */
export default function AuthCallbackScreen() {
  const { session } = useAuth();
  const router = useRouter();
  const { error } = useLocalSearchParams<{ error?: string }>();
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setTimedOut(true), EXCHANGE_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (session) {
      router.replace("/");
    } else if (error || timedOut) {
      router.replace("/login");
    }
  }, [session, error, timedOut, router]);

  return (
    <View className="flex-1 items-center justify-center gap-4 bg-background">
      <ActivityIndicator />
      <Text variant="muted">Finishing sign-in…</Text>
    </View>
  );
}

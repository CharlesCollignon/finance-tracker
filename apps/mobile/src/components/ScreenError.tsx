import { useEffect } from "react";
import { View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { ErrorBoundaryProps } from "expo-router";

import { resolveMessage } from "@finance/core/i18n/t";

import { Button } from "@/components/ui/Button";
import { Text } from "@/components/ui/Text";
import { hapticLight } from "@/lib/haptics";
import { useT } from "@/providers/LocaleProvider";
import { ICON } from "@/theme/tokens";
import { useThemeColors } from "@/theme/useThemeColors";

/**
 * What a screen shows when it could not load: that something went wrong,
 * that nothing was lost, and a way to try again — where each screen used to
 * print a line of red text with nowhere to go.
 *
 * Only a message the catalogue knows is shown as such. A load fails with
 * whatever the network or the database said, in English and in their terms;
 * that is for the logs, and the reader gets the app's own sentence instead.
 */
export function ScreenError({
  message,
  onRetry,
}: {
  message?: string | null;
  onRetry?: () => void;
}) {
  const t = useT();
  const colors = useThemeColors();
  const resolved = message ? resolveMessage(t, message) : null;
  const known = resolved !== null && resolved !== message;

  return (
    <View className="items-center gap-3 rounded-card border border-border bg-card/70 p-card">
      <Ionicons
        name="cloud-offline-outline"
        size={ICON.lg}
        color={colors.mutedForeground}
      />
      <Text accessibilityRole="header" className="text-center font-medium">
        {t("errorPage.title")}
      </Text>
      <Text variant="muted" className="text-center text-sm">
        {known ? resolved : t("errorPage.body")}
      </Text>
      {onRetry ? (
        <Button
          label={t("errorPage.tryAgain")}
          variant="outline"
          size="sm"
          onPress={() => {
            void hapticLight();
            onRetry();
          }}
        />
      ) : null}
    </View>
  );
}

/**
 * A layout's screen error boundary: a screen that throws while rendering
 * shows the same card, with the tab bar and the header still there to leave
 * by, rather than taking the whole app down to the root boundary.
 */
export function ScreenErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  useEffect(() => {
    console.error("Screen error boundary", error);
  }, [error]);

  return (
    <View className="flex-1 justify-center bg-background px-4">
      <ScreenError onRetry={() => void retry()} />
    </View>
  );
}

import { useEffect, useState } from "react";
import { Linking, Platform, Pressable, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Animated from "react-native-reanimated";

import { Text } from "@/components/ui/Text";
import { hapticLight } from "@/lib/haptics";
import {
  newerApk,
  readApkLater,
  setApkLater,
  useNouveautes,
} from "@/lib/nouveautes";
import { useAuth } from "@/providers/AuthProvider";
import { useT } from "@/providers/LocaleProvider";
import { ICON } from "@/theme/tokens";
import { useThemeColors } from "@/theme/useThemeColors";
import { FADE_IN, FADE_OUT } from "@/components/motion/fade";

/**
 * On Le point, when the site hands out an APK newer than this one: the APK
 * comes from the site, not a store, so nothing else would ever say so.
 * « Télécharger » opens it (`/android`); « Plus tard » puts this version's
 * banner away, until the next one. Android only — an iPhone has no APK.
 */
export function NewVersionBanner() {
  const t = useT();
  const colors = useThemeColors();
  const { user } = useAuth();
  const { feed } = useNouveautes(user?.id ?? null);
  const apk = Platform.OS === "android" ? newerApk(feed) : null;
  // The version put away with « Plus tard », once storage has answered.
  const [later, setLater] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    void readApkLater().then((version) => {
      if (!cancelled) {
        setLater(version);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!apk || later === undefined || later === apk.version) {
    return null;
  }

  return (
    <Animated.View
      entering={FADE_IN}
      exiting={FADE_OUT}
      className="gap-3 rounded-card border border-success/30 bg-success/10 p-card"
    >
      <View className="flex-row items-center gap-2">
        <Ionicons name="sparkles-outline" size={ICON.md} color={colors.foreground} />
        <Text variant="head" className="flex-1">
          {t("nouveautes.updateTitle")}
        </Text>
      </View>
      <Text variant="muted">
        {t("nouveautes.updateBody", { version: apk.version })}
      </Text>
      <View className="flex-row gap-2">
        <Pressable
          accessibilityRole="link"
          onPress={() => {
            void hapticLight();
            void Linking.openURL(apk.url);
          }}
          className="min-h-11 flex-1 items-center justify-center rounded-full bg-foreground"
        >
          <Text className="text-sm font-semibold text-background">
            {t("nouveautes.updateDownload")}
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            setLater(apk.version);
            void setApkLater(apk.version);
          }}
          className="min-h-11 items-center justify-center rounded-full border border-border px-5"
        >
          <Text className="text-sm font-medium">
            {t("nouveautes.updateLater")}
          </Text>
        </Pressable>
      </View>
    </Animated.View>
  );
}

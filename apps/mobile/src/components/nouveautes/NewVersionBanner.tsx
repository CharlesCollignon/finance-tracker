import { useCallback, useEffect, useRef, useState } from "react";
import { Linking, Platform, Pressable, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Animated from "react-native-reanimated";

import { Text } from "@/components/ui/Text";
import { hapticLight } from "@/lib/haptics";
import {
  downloadApk,
  installApk,
  onApkUpdateRequested,
  takeRequestedApkUpdate,
} from "@/lib/apk-update";
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
import type { File } from "expo-file-system";

/**
 * On Le point, when the site hands out an APK newer than this one: the APK
 * comes from the site, not a store, so nothing else would ever say so.
 * « Mettre à jour » downloads it here, with its progress, and hands it to
 * Android's installer (`lib/apk-update.ts`); if that fails, the site's
 * download (`/android`) stands in. « Plus tard » puts this version's banner
 * away, until the next one — unless the update notification is tapped,
 * which brings it back and starts at once. Android only.
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

  // The update itself, in this app (`lib/apk-update.ts`): idle, downloading
  // (with how far, when the server says how big the file is), ready to hand
  // to the installer again, or failed — then the site's download stands in.
  const [phase, setPhase] = useState<
    | { kind: "idle" }
    | { kind: "downloading"; fraction: number | null }
    | { kind: "ready"; file: File }
    | { kind: "failed" }
  >({ kind: "idle" });
  // Asked for from the notification: shown even after « Plus tard ».
  const [asked, setAsked] = useState<string | null>(null);
  const started = useRef(false);

  const update = useCallback(async () => {
    if (!apk || started.current) {
      return;
    }
    started.current = true;
    setPhase({ kind: "downloading", fraction: null });
    try {
      const file = await downloadApk(apk.url, apk.version, (fraction) =>
        setPhase({ kind: "downloading", fraction }),
      );
      setPhase({ kind: "ready", file });
      await installApk(file);
    } catch {
      setPhase({ kind: "failed" });
    } finally {
      started.current = false;
    }
  }, [apk]);

  // A tap on « Pluclair x.y.z est disponible » lands here: start at once.
  useEffect(() => {
    if (!apk) {
      return;
    }
    const take = () => {
      const version = takeRequestedApkUpdate();
      if (version === apk.version) {
        setAsked(version);
        void update();
      }
    };
    take();
    return onApkUpdateRequested(take);
  }, [apk, update]);

  if (
    !apk ||
    later === undefined ||
    (later === apk.version && asked !== apk.version)
  ) {
    return null;
  }

  const percent =
    phase.kind === "downloading" && phase.fraction !== null
      ? Math.round(phase.fraction * 100)
      : null;

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
        {phase.kind === "failed"
          ? t("apkUpdate.failed")
          : phase.kind === "ready"
            ? t("apkUpdate.installHint")
            : t("nouveautes.updateBody", { version: apk.version })}
      </Text>
      {phase.kind === "downloading" ? (
        <View className="gap-1.5">
          <View className="h-1.5 overflow-hidden rounded-full bg-foreground/10">
            <View
              className="h-full rounded-full bg-success"
              style={{ width: `${percent ?? 15}%` }}
            />
          </View>
          <Text variant="micro">
            {percent === null
              ? t("apkUpdate.downloading")
              : t("apkUpdate.downloadingPercent", { percent })}
          </Text>
        </View>
      ) : (
        <View className="flex-row gap-2">
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              void hapticLight();
              if (phase.kind === "ready") {
                void installApk(phase.file).catch(() =>
                  setPhase({ kind: "failed" }),
                );
              } else if (phase.kind === "failed") {
                // The site's own download, the way it was done before.
                void Linking.openURL(apk.url);
              } else {
                void update();
              }
            }}
            className="min-h-11 flex-1 items-center justify-center rounded-full bg-foreground"
          >
            <Text className="text-sm font-semibold text-background">
              {phase.kind === "ready"
                ? t("apkUpdate.install")
                : phase.kind === "failed"
                  ? t("apkUpdate.fromSite")
                  : t("apkUpdate.update")}
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              setAsked(null);
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
      )}
    </Animated.View>
  );
}

import { useEffect, useState } from "react";
import { View } from "react-native";
import { type Href, useLocalSearchParams, useRouter } from "expo-router";
import Animated, {
  FadeInDown,
  FadeInLeft,
  FadeInRight,
  useAnimatedStyle,
  useDerivedValue,
  withSpring,
} from "react-native-reanimated";

import { resolveMessage } from "@finance/core/i18n/t";
import {
  getMySpace,
  joinSpace,
  peekSpaceInvite,
  type SpaceInvite,
} from "@finance/data/spaces";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Screen } from "@/components/ui/Screen";
import { ScreenSkeleton } from "@/components/ui/Skeleton";
import { Text } from "@/components/ui/Text";
import { hapticSuccess } from "@/lib/haptics";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/providers/AuthProvider";
import { useT } from "@/providers/LocaleProvider";
import { useOwner } from "@/providers/OwnerProvider";
import { useThemeColors } from "@/theme/useThemeColors";

/** How long the two discs hold together before Le point opens. */
const JOINED_HOLD_MS = 900;

type Stage =
  | { kind: "loading" }
  | { kind: "unusable" }
  | { kind: "here" }
  | { kind: "elsewhere" }
  | { kind: "open"; invite: SpaceInvite };

/**
 * An invite to a shared space opened on the phone (`pluclair://join/<token>`),
 * the twin of the web's `/join/<token>`: who invites you to what, then one
 * button. Joining brings the two discs together, and Le point opens on the
 * space.
 */
export default function JoinScreen() {
  const t = useT();
  const router = useRouter();
  const { token } = useLocalSearchParams<{ token: string }>();
  const { user } = useAuth();
  const { showSpace } = useOwner();
  const [stage, setStage] = useState<Stage>({ kind: "loading" });
  const [pending, setPending] = useState(false);
  const [joined, setJoined] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user || !token) {
      return;
    }
    void Promise.all([
      peekSpaceInvite(supabase, token).catch(() => null),
      getMySpace(supabase, user.id).catch(() => null),
    ]).then(([invite, mine]) => {
      if (mine) {
        setStage({ kind: invite?.spaceId === mine.id ? "here" : "elsewhere" });
      } else if (!invite?.usable) {
        setStage({ kind: "unusable" });
      } else {
        setStage({ kind: "open", invite });
      }
    });
  }, [user, token]);

  const home = () => router.replace("/" as Href);

  async function join() {
    if (!token) {
      return;
    }
    setPending(true);
    setError(null);
    const result = await joinSpace(supabase, token);
    setPending(false);
    if (!result.success) {
      setError(resolveMessage(t, result.error));
      return;
    }
    void hapticSuccess();
    setJoined(true);
    showSpace(result.spaceId);
    setTimeout(home, JOINED_HOLD_MS);
  }

  const self =
    (user?.user_metadata?.full_name as string | undefined) ??
    user?.email ??
    "";

  return (
    <Screen
      title={t("space.section")}
      back={{ label: t("nav.bearing"), onPress: home }}
    >
      {stage.kind === "loading" ? (
        <ScreenSkeleton rows={2} />
      ) : (
        <Card bezel innerClassName="items-center gap-4 px-6 py-8">
          {stage.kind === "open" ? (
            <>
              <Pair
                left={stage.invite.invitedBy}
                right={self}
                together={joined}
              />
              <Heading>
                {t("space.joinTitle", {
                  name: stage.invite.invitedBy,
                  space: stage.invite.spaceName,
                })}
              </Heading>
              <Body>
                {t("space.joinBody", { name: stage.invite.invitedBy })}
              </Body>
              <Button
                variant="pill"
                size="lg"
                icon="arrow-forward"
                label={joined ? t("space.joined") : t("space.join")}
                disabled={pending || joined}
                onPress={() => void join()}
              />
              {error ? (
                <Text variant="micro" className="text-center text-destructive">
                  {error}
                </Text>
              ) : null}
            </>
          ) : stage.kind === "unusable" ? (
            <>
              <Heading>{t("space.inviteUnusable")}</Heading>
              <Body>{t("space.joinUnusableBody")}</Body>
              <Button variant="outline" label={t("nav.bearing")} onPress={home} />
            </>
          ) : stage.kind === "here" ? (
            <>
              <Heading>{t("space.joinAlreadyHere")}</Heading>
              <Button variant="pill" icon="arrow-forward" label={t("space.joinOpen")} onPress={home} />
            </>
          ) : (
            <>
              <Heading>{t("space.alreadyInOne")}</Heading>
              <Body>{t("space.joinElsewhereBody")}</Body>
              <Button
                variant="outline"
                label={t("nav.profile")}
                onPress={() => router.replace("/profile" as Href)}
              />
            </>
          )}
        </Card>
      )}
    </Screen>
  );
}

function Heading({ children }: { children: string }) {
  return (
    <Animated.View entering={FadeInDown.delay(150).duration(400)}>
      <Text variant="head" className="text-center text-2xl">
        {children}
      </Text>
    </Animated.View>
  );
}

function Body({ children }: { children: string }) {
  return (
    <Animated.View entering={FadeInDown.delay(250).duration(400)}>
      <Text variant="micro" className="text-center">
        {children}
      </Text>
    </Animated.View>
  );
}

/**
 * The inviter on the left, the reader on the right: they glide in and stop
 * short of each other, and joining closes the gap.
 */
function Pair({
  left,
  right,
  together,
}: {
  left: string;
  right: string;
  together: boolean;
}) {
  const colors = useThemeColors();
  const gap = useDerivedValue(() =>
    withSpring(together ? 10 : -4, { damping: 12, stiffness: 220 }),
  );
  const leftStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: gap.get() }],
  }));
  const rightStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: -gap.get() }],
  }));
  const disc = {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 4,
    borderColor: colors.background,
    alignItems: "center" as const,
    justifyContent: "center" as const,
  };
  const initial = (name: string) => (name.trim()[0] ?? "?").toUpperCase();

  return (
    <View className="h-20 flex-row items-center" importantForAccessibility="no">
      <Animated.View entering={FadeInLeft.springify().damping(14)}>
        <Animated.View
          style={[disc, { backgroundColor: colors.foreground, zIndex: 1 }, leftStyle]}
        >
          <Text className="font-sans text-2xl font-semibold" style={{ color: colors.background }}>
            {initial(left)}
          </Text>
        </Animated.View>
      </Animated.View>
      <Animated.View entering={FadeInRight.springify().damping(14)}>
        <Animated.View style={[disc, { backgroundColor: colors.muted }, rightStyle]}>
          <Text className="font-sans text-2xl font-semibold text-foreground">
            {initial(right)}
          </Text>
        </Animated.View>
      </Animated.View>
    </View>
  );
}

import { useState, type ReactNode } from "react";
import { View } from "react-native";
import Animated, {
  FadeIn,
  FadeInLeft,
  FadeInRight,
  ZoomOut,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";

import { resolveMessage } from "@finance/core/i18n/t";
import {
  createSpace,
  createSpaceInvite,
  leaveSpace,
  renameSpace,
} from "@finance/data/spaces";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { ListRow, ListSection } from "@/components/ui/ListRow";
import { Text } from "@/components/ui/Text";
import { hapticSuccess } from "@/lib/haptics";
import { exportSpaceRows, inviteUrl, sendInvite } from "@/lib/space";
import { supabase } from "@/lib/supabase";
import { useLocale, useT } from "@/providers/LocaleProvider";
import { useOwner } from "@/providers/OwnerProvider";
import { useToast } from "@/providers/ToastProvider";
import { ICON } from "@/theme/tokens";
import { useThemeColors } from "@/theme/useThemeColors";

type OpenRow = "spaceName" | "leave" | null;

/**
 * « Espace commun » in Profile, as on the web: make the space, send the link
 * that brings the partner in, name it, and leave it with its rows in hand.
 *
 * The two discs at the top are the space — you alone with an empty seat
 * while nobody has joined, then the two of you overlapping. They slide in
 * once and rest.
 */
export function SpaceSection({ selfName }: { selfName: string }) {
  const t = useT();
  const locale = useLocale();
  const { toast } = useToast();
  const { userId, space, setJoint } = useOwner();
  const [open, setOpen] = useState<OpenRow>(null);
  const [pending, setPending] = useState(false);
  const [name, setName] = useState(space?.name ?? "");

  const partner =
    space?.members.find((member) => member.userId !== userId) ?? null;
  const stage = !space ? "empty" : partner ? "together" : "waiting";

  function say(result: { error?: string; message?: string }, fallback?: string) {
    const text = result.error ?? result.message ?? fallback;
    if (text) {
      toast(resolveMessage(t, text), result.error ? "error" : "success");
    }
  }

  async function run(work: () => Promise<void>) {
    setPending(true);
    try {
      await work();
    } catch {
      toast(t("errors.couldNotSave"), "error");
    } finally {
      setPending(false);
    }
  }

  function toggle(row: Exclude<OpenRow, null>) {
    if (row === "spaceName") {
      setName(space?.name ?? "");
    }
    setOpen((current) => (current === row ? null : row));
  }

  const create = () =>
    run(async () => {
      const result = await createSpace(supabase);
      if (result.success) {
        void hapticSuccess();
      }
      say(result);
    });

  const invite = () =>
    run(async () => {
      if (!space) {
        return;
      }
      const result = await createSpaceInvite(supabase, space.id);
      if (!result.success) {
        say(result);
        return;
      }
      const url = inviteUrl(result.token);
      if (url) {
        await sendInvite(url, t("space.inviteShareText"));
      }
    });

  const rename = () =>
    run(async () => {
      if (!space) {
        return;
      }
      const result = await renameSpace(supabase, space.id, name);
      say(result, t("profile.saved"));
      if (result.success) {
        setOpen(null);
      }
    });

  const exportRows = () =>
    run(async () => {
      if (!space) {
        return;
      }
      const count = await exportSpaceRows(space.id, space.name, locale);
      if (count === 0) {
        toast(t("ledger.exportNothing"), "error");
      }
    });

  const leave = () =>
    run(async () => {
      if (!space) {
        return;
      }
      const result = await leaveSpace(supabase, space.id);
      say(result);
      if (result.success) {
        setJoint(false);
        setOpen(null);
      }
    });

  return (
    <ListSection title={t("space.section")} footer={t("space.footer")}>
      <Hero>
        <Pair self={selfName} partner={partner?.name ?? null} />
        <Animated.View
          key={stage}
          entering={FadeIn.duration(240)}
          className="items-center gap-1.5"
        >
          <Text variant="head" className="text-center">
            {space ? space.name : t("space.emptyTitle")}
          </Text>
          <Text variant="micro" className="text-center">
            {stage === "empty"
              ? t("space.emptyBody")
              : stage === "waiting"
                ? t("space.waitingBody")
                : t("space.togetherBody", { name: partner!.name })}
          </Text>
        </Animated.View>
        {stage === "empty" ? (
          <Button
            label={t("space.create")}
            size="sm"
            disabled={pending}
            onPress={() => void create()}
          />
        ) : null}
        {stage === "waiting" ? (
          <Button
            label={t("space.invite")}
            size="sm"
            icon="share-outline"
            disabled={pending}
            onPress={() => void invite()}
          />
        ) : null}
      </Hero>

      {space ? (
        <ListRow
          icon="pencil-outline"
          label={t("space.name")}
          value={open === "spaceName" ? undefined : space.name}
          onPress={() => toggle("spaceName")}
          expanded={
            open === "spaceName" ? (
              <View className="gap-3">
                <Input
                  value={name}
                  onChangeText={setName}
                  accessibilityLabel={t("space.name")}
                  maxLength={40}
                  returnKeyType="done"
                  onSubmitEditing={() => void rename()}
                />
                <Button
                  label={pending ? t("profile.saving") : t("profile.save")}
                  disabled={pending}
                  onPress={() => void rename()}
                />
              </View>
            ) : null
          }
        />
      ) : null}
      {space ? (
        <ListRow
          icon="exit-outline"
          label={t("space.leave")}
          destructive
          onPress={() => toggle("leave")}
          expanded={
            open === "leave" ? (
              <View className="gap-3">
                <Text variant="micro">
                  {partner
                    ? t("space.leaveBody", { name: partner.name })
                    : t("space.leaveLastBody")}
                </Text>
                {/* The rows first: once out, they cannot be read. */}
                <Button
                  label={t("space.export")}
                  variant="outline"
                  disabled={pending}
                  onPress={() => void exportRows()}
                />
                <Button
                  label={t("space.leaveConfirm")}
                  variant="secondary"
                  disabled={pending}
                  onPress={() => void leave()}
                />
              </View>
            ) : null
          }
        />
      ) : null}
    </ListSection>
  );
}

/**
 * The top of the section. A component of its own because `ListSection`
 * hands each child a `last` prop, which a row uses and this ignores.
 */
function Hero({ children }: { children: ReactNode; last?: boolean }) {
  return <View className="items-center gap-3 px-5 pb-5 pt-6">{children}</View>;
}

/**
 * You, and beside you your partner or the seat they will take. They slide
 * in from either side; once there are two, they overlap a little.
 */
function Pair({ self, partner }: { self: string; partner: string | null }) {
  const colors = useThemeColors();
  const disc = {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: colors.background,
    alignItems: "center" as const,
    justifyContent: "center" as const,
  };
  return (
    <View className="h-12 flex-row items-center" importantForAccessibility="no">
      <Animated.View
        entering={FadeInLeft.springify().damping(14)}
        style={[disc, { backgroundColor: colors.foreground, zIndex: 1 }]}
      >
        <Text
          className="font-sans text-lg font-semibold"
          style={{ color: colors.background }}
        >
          {(self.trim()[0] ?? "?").toUpperCase()}
        </Text>
      </Animated.View>
      {partner ? (
        <Animated.View
          key="partner"
          entering={FadeInRight.springify().damping(14)}
          style={[disc, { backgroundColor: colors.muted, marginLeft: -12 }]}
        >
          <Text className="font-sans text-lg font-semibold text-foreground">
            {(partner.trim()[0] ?? "?").toUpperCase()}
          </Text>
        </Animated.View>
      ) : (
        <Animated.View
          key="seat"
          entering={FadeInRight.springify().damping(14)}
          exiting={ZoomOut}
          style={[
            disc,
            {
              marginLeft: 4,
              borderStyle: "dashed",
              borderColor: colors.mutedForeground,
            },
          ]}
        >
          <Ionicons name="add" size={ICON.lg} color={colors.mutedForeground} />
        </Animated.View>
      )}
    </View>
  );
}

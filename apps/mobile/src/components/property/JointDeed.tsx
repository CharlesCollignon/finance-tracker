import { useState } from "react";
import { Pressable, View } from "react-native";
import Animated, {
  FadeIn,
  FadeInLeft,
  FadeInRight,
  FadeOut,
} from "react-native-reanimated";

import { resolveMessage } from "@finance/core/i18n/t";

import { percent, SplitEditor } from "@/components/space/SplitEditor";
import { Text } from "@/components/ui/Text";
import { setPropertyShare } from "@/lib/properties";
import { useT } from "@/providers/LocaleProvider";
import { useToast } from "@/providers/ToastProvider";
import { useThemeColors } from "@/theme/useThemeColors";

/** What the screen knows of a home owned through the space. */
export interface JointDeedView {
  /** The reader's part of the deed. */
  mine: number;
  selfName: string;
  partnerName: string;
}

/**
 * « Parts de l'acte », on a home the space owns (6c): who owns what of it,
 * two discs sized by their part, and each partner's net worth counting
 * theirs. Set once, from either side. The web's twin is `JointDeed.tsx`
 * beside the property page.
 */
export function JointDeed({
  propertyId,
  deed,
}: {
  propertyId: string;
  deed: JointDeedView;
}) {
  const t = useT();
  const colors = useThemeColors();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);

  async function save(share: number) {
    setPending(true);
    const result = await setPropertyShare(propertyId, share);
    setPending(false);
    toast(
      resolveMessage(t, result.error ?? t("profile.saved")),
      result.error ? "error" : "success",
    );
    if (!result.error) {
      setOpen(false);
    }
  }

  const people = [
    { name: deed.selfName, part: deed.mine, mine: true },
    { name: deed.partnerName, part: 1 - deed.mine, mine: false },
  ];

  return (
    <View className="gap-3 rounded-control border border-border p-4">
      <View className="flex-row items-center justify-between gap-3">
        <Text className="text-sm font-medium">{t("property.deedRow")}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ expanded: open }}
          hitSlop={8}
          onPress={() => setOpen((current) => !current)}
          className="rounded-full px-2 py-1"
        >
          <Text variant="muted" className="text-xs font-medium">
            {t("property.deedEdit")}
          </Text>
        </Pressable>
      </View>
      <View className="flex-row flex-wrap items-center gap-4">
        {people.map((person, index) => {
          const size = Math.round(28 + person.part * 16);
          return (
            <Animated.View
              key={`${index}-${person.name}`}
              entering={(index === 0 ? FadeInLeft : FadeInRight)
                .springify()
                .damping(16)}
              className="flex-row items-center gap-2"
            >
              <View
                importantForAccessibility="no"
                style={{
                  width: size,
                  height: size,
                  borderRadius: size / 2,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: person.mine
                    ? colors.foreground
                    : colors.muted,
                }}
              >
                <Text
                  className="font-sans text-sm font-semibold"
                  style={{
                    color: person.mine ? colors.background : colors.foreground,
                  }}
                >
                  {(person.name.trim()[0] ?? "?").toUpperCase()}
                </Text>
              </View>
              <Text className="text-sm">
                <Text className="text-sm font-medium">
                  {percent(person.part)}
                </Text>{" "}
                <Text variant="muted" className="text-sm">
                  {person.name}
                </Text>
              </Text>
            </Animated.View>
          );
        })}
      </View>
      {open ? (
        <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut}>
          <SplitEditor
            initial={deed.mine}
            partnerName={deed.partnerName}
            hint={t("property.deedHint")}
            pending={pending}
            onSave={(share) => void save(share)}
          />
        </Animated.View>
      ) : null}
    </View>
  );
}

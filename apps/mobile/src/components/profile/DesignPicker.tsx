import { Pressable, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { DESIGNS, type Design } from "@finance/core/designs";

import { Text } from "@/components/ui/Text";
import { hapticSelection } from "@/lib/haptics";
import { saveDesignPreference } from "@/lib/mutations";
import { useDesign } from "@/providers/DesignProvider";
import { useLocaleContext } from "@/providers/LocaleProvider";
import { useToast } from "@/providers/ToastProvider";
import { ICON } from "@/theme/tokens";
import { useThemeColors } from "@/theme/useThemeColors";

/**
 * Each design drawn small, in its own colours and figure face, whatever the
 * screen around it is in — a picture of the choice, so its values are
 * literal, the same as the web's swatches (`components/profile/DesignPicker`).
 */
const SWATCH: Record<
  Design,
  { ground: string; card: string; ink: string; accent: string; face: string; radius: number }
> = {
  nuit: { ground: "#0a0a10", card: "#131320", ink: "#ececf1", accent: "#fa9842", face: "Fraunces-SemiBold", radius: 8 },
  papier: { ground: "#f6f1e7", card: "#fbf8f2", ink: "#1c1a17", accent: "#9a3412", face: "Newsreader-SemiBold", radius: 2 },
  bento: { ground: "#eef0f3", card: "#ffffff", ink: "#0f1115", accent: "#2340f5", face: "BricolageGrotesque-Bold", radius: 12 },
  console: { ground: "#0b0b0b", card: "#121212", ink: "#ededed", accent: "#fa9842", face: "IBMPlexMono-Medium", radius: 1 },
};

/**
 * « Design », in the profile's « Apparence » section. A tap redraws the app
 * in that design at once (every screen remounts, see `app/_layout.tsx`),
 * then writes the row so the web follows.
 */
export function DesignPicker() {
  const { design, setDesign } = useDesign();
  const { locale, t } = useLocaleContext();
  const { toast } = useToast();
  const colors = useThemeColors();

  function choose(next: Design) {
    if (next === design) {
      return;
    }
    void hapticSelection();
    setDesign(next);
    void saveDesignPreference(next, locale).then((result) => {
      if (result.error) {
        toast(result.error, "error");
      }
    });
  }

  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={t("design.settingLabel")}
      className="flex-row flex-wrap gap-3 p-3"
    >
      {DESIGNS.map((id) => {
        const swatch = SWATCH[id];
        const selected = id === design;
        return (
          <Pressable
            key={id}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            accessibilityLabel={`${t(`design.${id}.name`)}, ${t(`design.${id}.hint`)}`}
            onPress={() => choose(id)}
            className="gap-2 rounded-control p-1.5 active:opacity-70"
            style={{
              width: "47%",
              flexGrow: 1,
              borderWidth: 2,
              borderColor: selected ? colors.primary : "transparent",
            }}
          >
            <View
              style={{
                height: 72,
                padding: 10,
                justifyContent: "space-between",
                backgroundColor: swatch.ground,
                borderRadius: swatch.radius + 4,
                borderWidth: 1,
                borderColor: "rgba(128,128,128,0.25)",
              }}
            >
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "flex-end",
                  justifyContent: "space-between",
                  paddingHorizontal: 8,
                  paddingVertical: 6,
                  backgroundColor: swatch.card,
                  borderRadius: swatch.radius,
                }}
              >
                <Text
                  numberOfLines={1}
                  style={{
                    fontFamily: swatch.face,
                    fontSize: 16,
                    color: swatch.ink,
                    fontVariant: ["tabular-nums"],
                  }}
                >
                  1 184 €
                </Text>
                <View
                  style={{
                    width: 18,
                    height: 6,
                    borderRadius: 3,
                    marginBottom: 3,
                    backgroundColor: swatch.accent,
                  }}
                />
              </View>
            </View>
            <View className="flex-row items-center justify-between px-1">
              <Text className="text-sm font-semibold">
                {t(`design.${id}.name`)}
              </Text>
              {selected ? (
                <Ionicons
                  name="checkmark"
                  size={ICON.md}
                  color={colors.primary}
                />
              ) : null}
            </View>
            <Text variant="muted" className="px-1 pb-1 text-xs">
              {t(`design.${id}.hint`)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

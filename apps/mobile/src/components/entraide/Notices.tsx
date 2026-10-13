import { View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Animated, {
  FadeIn,
  FadeOut,
  useReducedMotion,
} from "react-native-reanimated";

import type { EntraideDecision } from "@finance/core/entraide";
import type { EntraideCopy } from "@finance/core/entraide-copy";
import { maskPersonalData } from "@finance/core/entraide-mask";
import { DURATION } from "@finance/core/motion";

import { Text } from "@/components/ui/Text";
import { ICON } from "@/theme/tokens";
import { useThemeColors } from "@/theme/useThemeColors";

/**
 * Why a message of the reader's is hidden, as the rules promise to say it
 * on the message itself from the moment it takes effect (Digital Services
 * Act, art. 17): what was done, the rule, how it came about, the facts, and
 * how to challenge it. Without a decision to read, only that it is hidden.
 */
export function DecisionNotice({
  decision,
  copy,
}: {
  decision: EntraideDecision | undefined;
  copy: EntraideCopy;
}) {
  const colors = useThemeColors();
  const words = copy.decision;
  const rule =
    decision && decision.rule !== "none" ? copy.rules[decision.rule] : null;
  return (
    <View
      accessibilityRole="summary"
      className="flex-row items-start gap-3 rounded-control border border-border bg-foreground/5 px-4 py-3"
    >
      <Ionicons
        name="eye-off-outline"
        size={ICON.lg}
        color={colors.foreground}
      />
      <View className="flex-1 gap-1.5">
        <Text className="text-sm">{words.hidden}</Text>
        {decision?.action === "hide" && rule ? (
          <>
            <Text variant="muted">
              {decision.automatic
                ? words.automatic.replace("{rule}", rule)
                : `${words.moderator.replace("{rule}", rule)} ${
                    decision.fromReport
                      ? words.afterReport
                      : words.ownInitiative
                  }`}
            </Text>
            {decision.facts ? (
              <Text variant="muted">
                {words.facts.replace("{facts}", decision.facts)}
              </Text>
            ) : null}
            <Text variant="muted">{words.challenge}</Text>
          </>
        ) : null}
      </View>
    </View>
  );
}

/** What will be masked, said before anything goes out. */
export function MaskNotice({
  text,
  copy,
}: {
  text: string;
  copy: EntraideCopy;
}) {
  const colors = useThemeColors();
  const reduceMotion = useReducedMotion();
  const masked = maskPersonalData(text).masked;
  if (masked.length === 0) {
    return null;
  }
  return (
    <Animated.View
      entering={reduceMotion ? undefined : FadeIn.duration(DURATION.panel)}
      exiting={reduceMotion ? undefined : FadeOut.duration(DURATION.press)}
      accessibilityLiveRegion="polite"
      className="flex-row items-start gap-2"
    >
      <Ionicons
        name="shield-checkmark-outline"
        size={ICON.md}
        color={colors.foreground}
      />
      <Text className="flex-1 text-sm">
        {copy.composer.masked.replace(
          "{kinds}",
          masked.map((kind) => copy.composer.maskKinds[kind]).join(", "),
        )}
      </Text>
    </Animated.View>
  );
}

import { useState } from "react";
import { Pressable, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Animated, { ZoomIn } from "react-native-reanimated";

import type { ReactionKind, ReactionTally } from "@finance/core/reactions";

import { Text } from "@/components/ui/Text";
import { cn } from "@/lib/cn";
import { hapticLight } from "@/lib/haptics";
import { useThemeColors } from "@/theme/useThemeColors";

const REACTION_ICONS: Record<
  ReactionKind,
  [filled: keyof typeof Ionicons.glyphMap, outline: keyof typeof Ionicons.glyphMap]
> = {
  love: ["heart", "heart-outline"],
  useful: ["thumbs-up", "thumbs-up-outline"],
  finally: ["sparkles", "sparkles-outline"],
  want: ["hourglass", "hourglass-outline"],
  thanks: ["happy", "happy-outline"],
};

/**
 * « J'adore », « Utile », « Enfin ! » under a change, « J'attends ça » on
 * « Bientôt », « Utile » and « Merci » in Entraide, as on the site: the mark
 * pops filled as soon as it is pressed, with a light haptic, and goes back
 * if the write is refused. Ink, not gold: a reaction is not a decision.
 */
export function ReactionRow<K extends ReactionKind>({
  kinds,
  labels,
  tally,
  onReact,
  failedText,
  vote = false,
}: {
  kinds: readonly K[];
  labels: Record<K, string>;
  tally: ReactionTally;
  onReact: (kind: K) => Promise<{ ok: boolean }>;
  /** Said under the row when a write is refused. */
  failedText: string;
  /** A vote names itself beside its mark. */
  vote?: boolean;
}) {
  const colors = useThemeColors();
  const [pops, setPops] = useState<Partial<Record<ReactionKind, number>>>({});
  const [failed, setFailed] = useState(false);

  return (
    <View className="gap-1 pt-3">
      <View className="flex-row flex-wrap gap-1.5">
        {kinds.map((kind) => {
          const mine = tally.mine.includes(kind);
          const count = tally.counts[kind] ?? 0;
          const [filled, outline] = REACTION_ICONS[kind];
          return (
            <Pressable
              key={kind}
              accessibilityRole="button"
              accessibilityState={{ selected: mine }}
              accessibilityLabel={`${labels[kind]}${count > 0 ? ` (${count})` : ""}`}
              onPress={() => {
                void hapticLight();
                setFailed(false);
                if (!mine) {
                  setPops((current) => ({
                    ...current,
                    [kind]: (current[kind] ?? 0) + 1,
                  }));
                }
                void onReact(kind).then(({ ok }) => setFailed(!ok));
              }}
              className={cn(
                "min-h-11 flex-row items-center gap-1.5 rounded-full border px-3",
                mine ? "border-foreground/20 bg-foreground/10" : "border-border",
              )}
            >
              <Animated.View
                key={pops[kind] ?? 0}
                entering={pops[kind] ? ZoomIn.springify() : undefined}
              >
                <Ionicons
                  name={mine ? filled : outline}
                  size={15}
                  color={mine ? colors.foreground : colors.mutedForeground}
                />
              </Animated.View>
              {vote ? <Text className="text-sm">{labels[kind]}</Text> : null}
              {count > 0 ? (
                <Text
                  className={cn(
                    "text-sm",
                    mine ? "text-foreground" : "text-muted-foreground",
                  )}
                  style={{ fontVariant: ["tabular-nums"] }}
                >
                  {count}
                </Text>
              ) : null}
            </Pressable>
          );
        })}
      </View>
      {failed ? (
        <Text variant="muted" className="text-xs">
          {failedText}
        </Text>
      ) : null}
    </View>
  );
}

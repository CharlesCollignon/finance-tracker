import { View } from "react-native";
import type { StyleProp, TextStyle } from "react-native";

import type { SpineState } from "@finance/core/spine";

import { AnimatedAmount } from "@/components/AnimatedAmount";
import { Text } from "@/components/ui/Text";
import { useFormatCurrency } from "@/providers/CurrencyProvider";
import { useT } from "@/providers/LocaleProvider";
import { TYPE } from "@/theme/tokens";

/**
 * What the accounts hold, and what they are on course to hold.
 *
 * The phone's twin of `apps/web/components/finance/bearing/Headline.tsx`,
 * down to which two figures are stated and which of them is the larger — the
 * two clients show the same screen, so the thing a reader opens it for should
 * not be a different pair of numbers depending on which one they are holding.
 *
 * Both come off `resolveSpine`, which is kept rather than replaced because
 * its ladder is what makes them honest: a reader with no bank connected gets
 * no `onHand` at all and a headline that falls back to what the ledger has
 * recorded, rather than a confident zero.
 *
 * This is the half of the old `Spine` that was a figure. The ring and the
 * flame are still `Spine`'s and now live inside "Your run"; the action row
 * was already `AttentionRow`'s.
 */
export function Headline({ state }: { state: SpineState }) {
  const format = useFormatCurrency();
  const t = useT();

  return (
    <View className="gap-4 py-1">
      {state.onHand !== null ? (
        <Figure
          label={t("bearingFacts.onHand")}
          value={state.onHand}
          format={format}
        />
      ) : null}
      <Figure
        label={t(
          state.headline.figure === "free"
            ? "bearingFacts.free"
            : "bearing.remaining",
        )}
        value={state.headline.value}
        format={format}
        // One step down, and only when there is a figure above it to be a
        // step down from — a lone headline still owns the screen.
        style={state.onHand !== null ? TYPE.figure : TYPE.hero}
      />
    </View>
  );
}

function Figure({
  label,
  value,
  format,
  style = TYPE.hero,
}: {
  label: string;
  value: number;
  format: (value: number) => string;
  style?: StyleProp<TextStyle>;
}) {
  return (
    <View className="gap-0.5">
      <Text variant="muted" className="text-sm">
        {label}
      </Text>
      <AnimatedAmount value={value} format={format} style={style} />
    </View>
  );
}

import { View } from "react-native";
import type { StyleProp, TextStyle } from "react-native";

import type { Key } from "@finance/core/i18n/t";
import type { SpineState } from "@finance/core/spine";

import { AnimatedAmount } from "@/components/AnimatedAmount";
import { Text } from "@/components/ui/Text";
import { cn } from "@/lib/cn";
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
        label={t(headlineLabelKey(state.headline))}
        value={state.headline.value}
        format={format}
        // One step down, and only when there is a figure above it to be a
        // step down from — a lone headline still owns the screen.
        style={state.onHand !== null ? TYPE.figure : TYPE.hero}
        short={isShort(state.headline)}
      />
    </View>
  );
}

/** A month that has already spent more than it had. */
function isShort(headline: SpineState["headline"]): boolean {
  return headline.figure === "free" && headline.value < 0;
}

/**
 * What the headline figure is called — which, when `free` has gone under,
 * is not what it is called the rest of the time.
 *
 * The web twin's rule, word for word, and the old `Spine`'s before that:
 * `pulse.headlineShort` is "Short by" / "Il manque". Saying "Yours to spend
 * this month −412,00 €" at the largest type on the screen reads as an offer,
 * and it is the opposite of one.
 */
function headlineLabelKey(headline: SpineState["headline"]): Key {
  if (headline.figure !== "free") {
    return "bearing.remaining";
  }
  return headline.value < 0 ? "pulse.headlineShort" : "bearingFacts.free";
}

function Figure({
  label,
  value,
  format,
  style = TYPE.hero,
  short = false,
}: {
  label: string;
  value: number;
  format: (value: number) => string;
  style?: StyleProp<TextStyle>;
  /** Drawn destructive, the way `toneFor` draws the same figure on its card. */
  short?: boolean;
}) {
  return (
    <View className="gap-0.5">
      <Text variant="muted" className="text-sm">
        {label}
      </Text>
      {/* A class and not a `style` colour, for the reason `BearingCards`'
          `toneFor` sets out at length: `PrivateAmount` adds a
          `text-foreground` of its own whenever the className it is handed
          carries none, and `lib/text-class.ts` reasons about className
          against className and says nothing about className against `style`.
          The size stays in `style`, where `TYPE` keeps it. */}
      <AnimatedAmount
        value={value}
        format={format}
        style={style}
        className={cn(short && "text-destructive")}
      />
    </View>
  );
}

import { View } from "react-native";

import type { SpineState } from "@finance/core/spine";

import { StatHero } from "@/components/StatHero";
import { useFormatCurrency } from "@/providers/CurrencyProvider";
import { useT } from "@/providers/LocaleProvider";

/**
 * What the accounts hold, and what they are on course to hold.
 *
 * The phone's twin of `apps/web/components/finance/bearing/Headline.tsx`,
 * down to which two figures are stated and what they are called — the two
 * clients show the same screen, so the thing a reader opens it for should not
 * be a different pair of numbers depending on which one they are holding.
 *
 * Both come off `resolveSpine`, which is kept rather than replaced because
 * its ladder is what makes them honest: a reader with no bank connected gets
 * no `onHand` at all and a headline that falls back to what the ledger has
 * recorded, rather than a confident zero.
 *
 * Drawn with `StatHero`, which is what carries the serif at hero size through
 * `TYPE.hero` along with a quiet label over it. The one place this parts from
 * the web is the arrangement: the web sets the two side by side from `md` up,
 * and a phone has no width for a second column, so they stay stacked.
 *
 * This is the half of the old `Spine` that was a figure. The ring is still
 * `Spine`'s and now lives inside "Your run"; the action row was already
 * `AttentionRow`'s.
 */
export function Headline({ state }: { state: SpineState }) {
  const format = useFormatCurrency();
  const t = useT();

  return (
    <View className="gap-6 py-1">
      {state.onHand !== null ? (
        <StatHero
          label={t("bearing.headline.onHand")}
          amount={format(state.onHand)}
          animateValue={state.onHand}
          format={format}
        />
      ) : null}
      <StatHero
        label={t(
          state.headline.figure === "free"
            ? "bearing.headline.free"
            : "bearing.headline.remaining",
        )}
        amount={format(state.headline.value)}
        animateValue={state.headline.value}
        format={format}
        // A class and not a `style` colour, for the reason `BearingCards`'
        // `toneFor` sets out at length: `PrivateAmount` adds a
        // `text-foreground` of its own whenever the className it is handed
        // carries none, and `lib/text-class.ts` reasons about className
        // against className and says nothing about className against `style`.
        // The size stays in `style`, where `StatHero` keeps it.
        //
        // The wording no longer changes with the sign — "vous finirez le mois
        // à −412,00 €" is not the offer that the old label was, so the swap
        // to `pulse.headlineShort` has nothing left to fix.
        amountClassName={
          isShort(state.headline) ? "text-destructive" : undefined
        }
      />
    </View>
  );
}

/** A month that has already spent more than it had. */
function isShort(headline: SpineState["headline"]): boolean {
  return headline.figure === "free" && headline.value < 0;
}

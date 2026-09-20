"use client";

import type { Key } from "@finance/core/i18n/t";
import type { SpineState } from "@finance/core/spine";
import { AnimatedAmount } from "@/components/finance/AnimatedAmount";
import { useFormatCurrency } from "@/lib/use-currency";
import { useT } from "@/lib/locale-context";
import { cn } from "@/lib/utils";

/**
 * What the accounts hold, and what they are on course to hold.
 *
 * The two figures a reader opens this screen for, and nothing else. Both come
 * off `resolveSpine`, which is kept rather than replaced because its ladder
 * is the thing that makes them honest: a reader with no bank connected gets
 * no `onHand` at all and a headline that falls back to what the ledger has
 * recorded, rather than a confident zero.
 *
 * Numbers go through `AnimatedAmount` — the house count-up. React Bits'
 * `CountUp` was vendored here once and removed: it formats its own digits and
 * takes no format function, so it cannot render the reader's currency, and it
 * draws straight through the privacy blur.
 */
export function Headline({ state }: { state: SpineState }) {
  const t = useT();
  const format = useFormatCurrency();
  const short = isShort(state.headline);

  return (
    <div className="flex flex-col gap-4 py-2">
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
        muted={state.onHand !== null}
        short={short}
      />
    </div>
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
 * The old `Spine` chose this through the same two clauses and the wording is
 * its, not a new one: `pulse.headlineShort` is "Short by" / "Il manque".
 * Saying "Yours to spend this month −412,00 €" at the largest type in the
 * app reads as an offer, and it is the opposite of one.
 *
 * `bearingFacts.free` and `bearing.remaining` are this screen's own words
 * for the two other cases, rather than `pulse`'s — they are the labels the
 * fact pack already gives these two figures, and the figure above uses
 * `bearingFacts.onHand` for the same reason.
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
  muted = false,
  short = false,
}: {
  label: string;
  value: number;
  format: (value: number) => string;
  muted?: boolean;
  /** Drawn destructive, the way `toneFor` draws the same figure on its card. */
  short?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-sm text-muted-foreground">{label}</span>
      <AnimatedAmount
        value={value}
        format={format}
        title={label}
        className={cn(
          muted
            ? "text-3xl font-semibold tabular-nums md:text-4xl"
            : "text-4xl font-semibold tabular-nums md:text-5xl",
          // The "This month" card, forty pixels below, states this same
          // `free` through `toneFor` and paints a negative one
          // `text-destructive`. A plain-foreground headline had the screen
          // disagreeing with itself about one number.
          short && "text-destructive",
        )}
      />
    </div>
  );
}

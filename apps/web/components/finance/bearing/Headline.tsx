"use client";

import type { SpineState } from "@finance/core/spine";
import { StatHero } from "@/components/finance/StatHero";
import { useFormatCurrency } from "@/lib/use-currency";
import { useT } from "@/lib/locale-context";

/**
 * What the accounts hold, and what they are on course to hold.
 *
 * The two figures a reader opens this screen for, and nothing else. Both come
 * off `resolveSpine`, which is kept rather than replaced because its ladder
 * is the thing that makes them honest: a reader with no bank connected gets
 * no `onHand` at all and a headline that falls back to what the ledger has
 * recorded, rather than a confident zero.
 *
 * Drawn with `StatHero` rather than a local figure, which is what puts these
 * two in the serif at hero size with a quiet label over them — the same
 * treatment Wallets and the look-through already give the one figure that
 * owns their screen. It also means the face, the weight and the digit metric
 * arrive together through `FIGURE_HERO`, so a figure here cannot pick up the
 * size of a hero and the face of body copy.
 *
 * Side by side from `md` up, stacked below it. Two hero figures in one column
 * pushes the cards past the fold on a laptop; two columns keeps both at full
 * size and the first card in view. A lone figure — no bank — renders as one
 * centred column rather than stranded in the left half of a grid.
 *
 * Numbers go through `AnimatedAmount` inside `StatHero`. React Bits' `CountUp`
 * was vendored here once and removed: it formats its own digits and takes no
 * format function, so it cannot render the reader's currency, and it draws
 * straight through the privacy blur.
 */
export function Headline({ state }: { state: SpineState }) {
  const t = useT();
  const format = useFormatCurrency();

  const banked = state.onHand !== null;

  return (
    <div
      className={
        banked
          ? "grid w-full gap-8 py-2 md:grid-cols-2 md:gap-6"
          : "flex w-full flex-col py-2"
      }
    >
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
        // The "This month" card, below, states this same `free` through
        // `toneFor` and paints a negative one `text-destructive`. A
        // plain-foreground headline had the screen disagreeing with itself
        // about one number.
        //
        // The wording no longer changes with the sign. "You'll finish the
        // month at −412,00 €" is not the offer that "Yours to spend this
        // month −412,00 €" was, so the old swap to `pulse.headlineShort`
        // has nothing left to fix — see `bearing.headline` in the catalogue.
        amountClassName={
          isShort(state.headline) ? "text-destructive" : undefined
        }
      />
    </div>
  );
}

/** A month that has already spent more than it had. */
function isShort(headline: SpineState["headline"]): boolean {
  return headline.figure === "free" && headline.value < 0;
}

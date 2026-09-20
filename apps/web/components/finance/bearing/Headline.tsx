"use client";

import type { SpineState } from "@finance/core/spine";
import { AnimatedAmount } from "@/components/finance/AnimatedAmount";
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
 * Numbers go through `AnimatedAmount` — the house count-up. React Bits'
 * `CountUp` was vendored here once and removed: it formats its own digits and
 * takes no format function, so it cannot render the reader's currency, and it
 * draws straight through the privacy blur.
 */
export function Headline({ state }: { state: SpineState }) {
  const t = useT();
  const format = useFormatCurrency();

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
        label={t(
          state.headline.figure === "free"
            ? "bearingFacts.free"
            : "bearing.remaining",
        )}
        value={state.headline.value}
        format={format}
        muted={state.onHand !== null}
      />
    </div>
  );
}

function Figure({
  label,
  value,
  format,
  muted = false,
}: {
  label: string;
  value: number;
  format: (value: number) => string;
  muted?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-sm text-muted-foreground">{label}</span>
      <AnimatedAmount
        value={value}
        format={format}
        title={label}
        className={
          muted
            ? "text-3xl font-semibold tabular-nums md:text-4xl"
            : "text-4xl font-semibold tabular-nums md:text-5xl"
        }
      />
    </div>
  );
}

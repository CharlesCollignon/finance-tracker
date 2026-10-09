"use client";

import { useState } from "react";
import { AnimatePresence, m } from "motion/react";
import { landingSampleFor } from "@/components/marketing/landing-sample";
import type { LocalisedLandingCopy } from "@/components/marketing/landing-copy";
import { useLocale } from "@/lib/locale-context";
import { useFormatCurrency } from "@/lib/use-currency";
import { Count, Range } from "./parts";

type Copy = LocalisedLandingCopy["demos"]["month-close"];

/**
 * The close, played: what the rows say the account should hold, and what
 * the bank shows, dragged. The gap between the two bars lights gold — the
 * money that left without a row — and says how much.
 */
export function MonthCloseDemo({ copy }: { copy: Copy }) {
  const euro = useFormatCurrency();
  const { close } = landingSampleFor(useLocale());
  const expected = close.openingBalance + close.recordedIn - close.recordedOut;
  const [bank, setBank] = useState(close.closingBalance);
  const gap = Math.max(0, expected - bank);
  const low = expected - 600;
  const bankShare = (bank - low) / (expected - low);

  return (
    <div className="flex flex-col gap-10">
      <Range
        label={copy.bank}
        value={bank}
        min={low}
        max={expected}
        step={2}
        onChange={setBank}
        display={euro(bank)}
      />
      <div className="flex flex-col gap-4">
        <Bar label={copy.expected} value={euro(expected)} share={1} />
        <div>
          <div className="mb-2 flex items-baseline justify-between text-sm">
            <span className="text-marketing-muted">{copy.bank}</span>
            <span className="font-mono text-marketing-ink">{euro(bank)}</span>
          </div>
          <div className="relative flex h-10 overflow-hidden rounded-xl bg-white/[0.05]">
            <m.div
              className="h-full rounded-l-xl bg-white/25"
              animate={{ width: `${bankShare * 100}%` }}
              transition={{ type: "spring", stiffness: 160, damping: 24 }}
            />
            <m.div
              className="h-full bg-[repeating-linear-gradient(135deg,rgb(236_178_94/0.85)_0_6px,rgb(236_178_94/0.45)_6px_12px)] shadow-[0_0_30px_rgb(236_178_94/0.5)]"
              animate={{ width: `${(1 - bankShare) * 100}%` }}
              transition={{ type: "spring", stiffness: 160, damping: 24 }}
            />
          </div>
        </div>
      </div>
      <div aria-live="polite" className="min-h-20">
        <AnimatePresence mode="wait" initial={false}>
          {gap > 0 ? (
            <m.div
              key="gap"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <p className="text-sm text-marketing-muted">{copy.gap}</p>
              <p className="mt-1 font-serif text-[clamp(2.5rem,7vw,4.5rem)] font-semibold leading-none text-primary">
                <Count
                  value={gap}
                  format={(value) => euro(Math.round(value))}
                />
              </p>
            </m.div>
          ) : (
            <m.p
              key="none"
              className="text-lg text-marketing-ink"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              {copy.none}
            </m.p>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function Bar({
  label,
  value,
  share,
}: {
  label: string;
  value: string;
  share: number;
}) {
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between text-sm">
        <span className="text-marketing-muted">{label}</span>
        <span className="font-mono text-marketing-ink">{value}</span>
      </div>
      <m.div
        className="h-10 origin-left rounded-xl bg-white/25"
        initial={{ scaleX: 0 }}
        whileInView={{ scaleX: share }}
        viewport={{ once: true }}
        transition={{ duration: 1, ease: [0.32, 0.72, 0, 1] }}
      />
    </div>
  );
}

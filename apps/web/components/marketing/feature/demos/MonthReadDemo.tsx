"use client";

import { useState } from "react";
import { AnimatePresence, m } from "motion/react";
import type { LocalisedLandingCopy } from "@/components/marketing/landing-copy";
import { useFormatCurrency } from "@/lib/use-currency";
import { cn } from "@/lib/utils";

type Copy = LocalisedLandingCopy["demos"]["month-read"];

/** The sample's figures the sentence names: groceries, the margin, rent. */
const FIGURES = { groceries: 218, marge: 260, housing: 850 } as const;
type FigureId = keyof typeof FIGURES;

/**
 * A read's sentence, its words arriving one after another, its figures
 * set in gold — and pointing at one says where it comes from: a row of the
 * reader's own, never a number the AI wrote.
 */
export function MonthReadDemo({ copy }: { copy: Copy }) {
  const euro = useFormatCurrency();
  const [pointed, setPointed] = useState<FigureId>("groceries");
  const parts = copy.sentence.split(/(\{\w+\})/).filter(Boolean);

  return (
    <div className="grid gap-10 md:grid-cols-[minmax(0,7fr)_minmax(0,4fr)] md:items-center">
      <m.p
        className="text-[clamp(1.4rem,2.6vw,2rem)] leading-snug text-marketing-ink"
        initial="hidden"
        whileInView="shown"
        viewport={{ once: true, amount: 0.6 }}
        transition={{ staggerChildren: 0.04 }}
      >
        {parts.flatMap((part, partIndex) => {
          const id = part.match(/^\{(\w+)\}$/)?.[1] as FigureId | undefined;
          if (id && id in FIGURES) {
            return [
              <m.button
                key={`f-${partIndex}`}
                type="button"
                variants={reveal}
                onPointerEnter={() => setPointed(id)}
                onFocus={() => setPointed(id)}
                onClick={() => setPointed(id)}
                className={cn(
                  "mx-1 inline-block rounded-lg px-2 font-mono transition-colors duration-200",
                  pointed === id
                    ? "bg-primary text-primary-foreground"
                    : "bg-primary/15 text-primary",
                )}
              >
                {euro(FIGURES[id])}
              </m.button>,
            ];
          }
          return part
            .split(" ")
            .filter(Boolean)
            .map((text, index) => {
              return (
                <m.span
                  key={`w-${partIndex}-${index}`}
                  variants={reveal}
                  className="inline-block"
                >
                  {text}&nbsp;
                </m.span>
              );
            });
        })}
      </m.p>
      <div className="relative min-h-36" aria-live="polite">
        <AnimatePresence mode="wait">
          <m.div
            key={pointed}
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -16 }}
            transition={{ duration: 0.3, ease: [0.32, 0.72, 0, 1] }}
            className="rounded-2xl border border-white/10 bg-white/[0.04] p-5"
          >
            <p className="text-xs uppercase tracking-[0.16em] text-marketing-faint">
              {copy.from}
            </p>
            <p className="mt-2 text-marketing-ink">{copy.sources[pointed]}</p>
            <p className="mt-3 font-serif text-4xl font-semibold text-primary">
              {euro(FIGURES[pointed])}
            </p>
          </m.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

const reveal = {
  hidden: { opacity: 0, y: 12, filter: "blur(4px)" },
  shown: { opacity: 1, y: 0, filter: "blur(0px)" },
};

"use client";

import { useState } from "react";
import { AnimatePresence, m } from "motion/react";
import { landingSampleFor } from "@/components/marketing/landing-sample";
import type { LocalisedLandingCopy } from "@/components/marketing/landing-copy";
import { useLocale } from "@/lib/locale-context";
import { useFormatCurrency } from "@/lib/use-currency";
import { cn } from "@/lib/utils";
import { Count } from "./parts";

type Copy = LocalisedLandingCopy["demos"]["tax"];

/** Each category's box and its year's amount, in the copy's order. */
const CATEGORIES = [
  { box: "7UF", amount: 120 },
  { box: "7UF", amount: 120 },
  { box: "7DB", amount: 1860 },
  { box: "5NI", amount: 8280 },
];

/**
 * Filing categories into boxes, by tap: the chip leaves the tray and lands
 * in its box, whose amount counts up to the year's sum. Tap it in the box to
 * take it back out.
 */
export function TaxDemo({ copy }: { copy: Copy }) {
  const euro = useFormatCurrency();
  const { tax } = landingSampleFor(useLocale());
  const [filed, setFiled] = useState<number[]>([]);
  const toggle = (index: number) =>
    setFiled((current) =>
      current.includes(index)
        ? current.filter((i) => i !== index)
        : [...current, index],
    );

  const chip = (index: number) => (
    <m.button
      key={index}
      type="button"
      onClick={() => toggle(index)}
      initial={{ opacity: 0, scale: 0.8, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.8, y: -10 }}
      whileTap={{ scale: 0.94 }}
      transition={{ type: "spring", stiffness: 320, damping: 22 }}
      className={cn(
        "rounded-full border px-3 py-1.5 text-sm transition-colors",
        filed.includes(index)
          ? "border-primary/40 bg-primary/15 text-marketing-ink"
          : "border-white/15 text-marketing-muted hover:border-white/30 hover:text-white",
      )}
    >
      {copy.chips[index]}
    </m.button>
  );

  return (
    <div className="flex flex-col gap-8">
      <div className="flex min-h-12 flex-wrap gap-2 rounded-2xl border border-dashed border-white/15 p-3">
        <AnimatePresence mode="popLayout">
          {CATEGORIES.map((_, index) =>
            filed.includes(index) ? null : chip(index),
          )}
        </AnimatePresence>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {tax.boxes.map((box) => {
          const inside = CATEGORIES.map((category, index) => ({
            ...category,
            index,
          })).filter(
            (category) =>
              category.box === box.id && filed.includes(category.index),
          );
          const total = inside.reduce(
            (sum, category) => sum + category.amount,
            0,
          );
          return (
            <div
              key={box.id}
              className={cn(
                "flex min-h-48 flex-col gap-3 rounded-[1.5rem] border p-5 transition-colors duration-500",
                total > 0
                  ? "border-primary/40 bg-primary/[0.06]"
                  : "border-white/10 bg-white/[0.03]",
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <span className="text-sm text-marketing-muted">
                  {box.label}
                </span>
                <span className="rounded-md border border-white/15 px-2 py-0.5 font-mono text-xs font-semibold text-marketing-ink">
                  {box.id}
                </span>
              </div>
              <p className="font-serif text-3xl font-semibold text-marketing-ink">
                <Count
                  value={total}
                  format={(value) => euro(Math.round(value))}
                />
              </p>
              <div className="flex flex-wrap gap-2">
                <AnimatePresence mode="popLayout">
                  {inside.map((category) => chip(category.index))}
                </AnimatePresence>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

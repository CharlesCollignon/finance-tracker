"use client";

import { useState } from "react";
import { AnimatePresence, m } from "motion/react";
import type { LocalisedLandingCopy } from "@/components/marketing/landing-copy";
import { useFormatCurrency } from "@/lib/use-currency";
import { Chip, Count } from "./parts";

type Copy = LocalisedLandingCopy["demos"]["ledger"];

/** What each shop costs in the demo, in the order the copy lists them. */
const AMOUNTS = [-42.3, -35, -6.4, -15.99];

interface Row {
  key: number;
  shop: string;
  category: string;
  amount: number;
}

/**
 * The add sheet's shop field, played: tap a shop and its row drops into the
 * list, the category it went in last time arriving a beat later — the
 * suggestion the app makes — and the day's total following.
 */
export function LedgerDemo({ copy }: { copy: Copy }) {
  const euro = useFormatCurrency();
  const [rows, setRows] = useState<Row[]>([]);
  const [next, setNext] = useState(0);
  const total = rows.reduce((sum, row) => sum + row.amount, 0);

  function add(index: number) {
    const shop = copy.shops[index]!;
    setRows((current) =>
      [
        {
          key: next,
          shop: shop.shop,
          category: shop.category,
          amount: AMOUNTS[index]!,
        },
        ...current,
      ].slice(0, 4),
    );
    setNext((key) => key + 1);
  }

  return (
    <div className="grid gap-8 md:grid-cols-[minmax(0,4fr)_minmax(0,6fr)]">
      <div className="flex flex-wrap content-start gap-2">
        {copy.shops.map((shop, index) => (
          <Chip key={shop.shop} active={false} onClick={() => add(index)}>
            + {shop.shop}
          </Chip>
        ))}
      </div>
      <div className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between text-sm">
          <span className="text-marketing-muted">{copy.added}</span>
          <Count
            value={total}
            format={(value) => euro(Math.round(value * 100) / 100)}
            className="font-mono text-marketing-ink"
          />
        </div>
        <ul className="flex min-h-64 flex-col gap-2">
          <AnimatePresence initial={false}>
            {rows.map((row) => (
              <m.li
                key={row.key}
                initial={{ opacity: 0, y: -24, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, x: 40 }}
                transition={{ type: "spring", stiffness: 300, damping: 26 }}
                className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3"
              >
                <span className="flex-1 text-marketing-ink">{row.shop}</span>
                <m.span
                  className="rounded-full bg-primary/15 px-2.5 py-1 text-xs text-primary"
                  initial={{ opacity: 0, scale: 0.6 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{
                    type: "spring",
                    stiffness: 380,
                    damping: 18,
                    delay: 0.35,
                  }}
                >
                  {row.category}
                </m.span>
                <span className="w-20 text-right font-mono text-sm text-marketing-muted">
                  {euro(row.amount)}
                </span>
              </m.li>
            ))}
          </AnimatePresence>
        </ul>
      </div>
    </div>
  );
}

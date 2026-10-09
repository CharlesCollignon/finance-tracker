"use client";

import { useState } from "react";
import { m } from "motion/react";
import type { LocalisedLandingCopy } from "@/components/marketing/landing-copy";
import { cn } from "@/lib/utils";
import { Chip } from "./parts";

type Copy = LocalisedLandingCopy["demos"]["wallets"];

/** An MSCI World tracker's weights, in percent, in the copy's order. */
const WEIGHTS = {
  countries: [71, 6, 4, 3, 3, 13],
  sectors: [24, 15, 12, 11, 10, 28],
};

/**
 * One fund, opened: its weights by country or by sector as bars that grow
 * from nothing when it comes into view and re-grow on each switch, the one
 * under the pointer lit and the others stepping back.
 */
export function WalletsDemo({ copy }: { copy: Copy }) {
  const [tab, setTab] = useState<"countries" | "sectors">("countries");
  const [hovered, setHovered] = useState<number | null>(null);
  const labels = tab === "countries" ? copy.countries : copy.sectors;
  const weights = WEIGHTS[tab];
  const largest = Math.max(...weights);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <span className="inline-flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
          <span className="size-2.5 rounded-full bg-primary shadow-[0_0_12px_rgb(236_178_94/0.8)]" />
          <span className="font-medium text-marketing-ink">{copy.fund}</span>
        </span>
        <div className="flex gap-2">
          <Chip
            active={tab === "countries"}
            onClick={() => setTab("countries")}
          >
            {copy.countriesTab}
          </Chip>
          <Chip active={tab === "sectors"} onClick={() => setTab("sectors")}>
            {copy.sectorsTab}
          </Chip>
        </div>
      </div>
      <m.ul
        key={tab}
        className="flex flex-col gap-3"
        initial="hidden"
        whileInView="shown"
        viewport={{ once: false, amount: 0.4 }}
        transition={{ staggerChildren: 0.07 }}
        onPointerLeave={() => setHovered(null)}
      >
        {labels.map((label, index) => {
          const weight = weights[index]!;
          const dim = hovered !== null && hovered !== index;
          return (
            <li
              key={label}
              onPointerEnter={() => setHovered(index)}
              className={cn(
                "grid grid-cols-[minmax(0,9rem)_minmax(0,1fr)_3rem] items-center gap-4 transition-opacity duration-300",
                dim && "opacity-40",
              )}
            >
              <span className="truncate text-sm text-marketing-muted">
                {label}
              </span>
              <span className="h-3 overflow-hidden rounded-full bg-white/[0.06]">
                <m.span
                  className={cn(
                    "block h-full origin-left rounded-full",
                    index === 0 ? "bg-primary" : "bg-white/40",
                  )}
                  variants={{
                    hidden: { scaleX: 0 },
                    shown: {
                      scaleX: weight / largest,
                      transition: {
                        type: "spring",
                        stiffness: 120,
                        damping: 20,
                      },
                    },
                  }}
                />
              </span>
              <span className="text-right font-mono text-sm text-marketing-ink">
                {weight} %
              </span>
            </li>
          );
        })}
      </m.ul>
    </div>
  );
}

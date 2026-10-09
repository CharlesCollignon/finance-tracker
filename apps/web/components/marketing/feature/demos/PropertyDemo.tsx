"use client";

import { useState } from "react";
import { m } from "motion/react";
import { landingSampleFor } from "@/components/marketing/landing-sample";
import type { LocalisedLandingCopy } from "@/components/marketing/landing-copy";
import { useLocale } from "@/lib/locale-context";
import { useFormatCurrency } from "@/lib/use-currency";
import { Count, Range } from "./parts";

type Copy = LocalisedLandingCopy["demos"]["property"];

const FIRST = 2026;
const YEARS = 15;
const RATE = 0.035;

/** What is left on a loan after `k` of its `n` yearly payments. */
function owedAfter(start: number, k: number) {
  const growth = (1 + RATE) ** YEARS;
  return start * ((growth - (1 + RATE) ** k) / (growth - 1));
}

/**
 * The years of the loan, on a slider: the curve of what is still owed
 * drawn as it comes into view, a dot riding it to the year chosen, and the
 * part of the home that is yours filling as the loan falls.
 */
export function PropertyDemo({ copy }: { copy: Copy }) {
  const euro = useFormatCurrency();
  const { property } = landingSampleFor(useLocale());
  const [year, setYear] = useState(FIRST);
  const owed = owedAfter(property.owed, year - FIRST);
  const yours = property.value - owed;
  const share = yours / property.value;

  const width = 600;
  const height = 200;
  const points = Array.from({ length: YEARS + 1 }, (_, k) => {
    const x = (k / YEARS) * width;
    const y =
      height - (owedAfter(property.owed, k) / property.owed) * (height - 16);
    return [x, y] as const;
  });
  const path = points
    .map(([x, y], k) => `${k === 0 ? "M" : "L"}${x},${y}`)
    .join(" ");
  const [dotX, dotY] = points[year - FIRST]!;

  return (
    <div className="grid gap-10 md:grid-cols-[minmax(0,6fr)_minmax(0,4fr)] md:items-center">
      <div className="flex flex-col gap-6">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="h-auto w-full overflow-visible"
        >
          <m.path
            d={path}
            fill="none"
            stroke="rgb(255 255 255 / 0.45)"
            strokeWidth={2.5}
            initial={{ pathLength: 0 }}
            whileInView={{ pathLength: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 1.6, ease: [0.32, 0.72, 0, 1] }}
          />
          <m.circle
            r={8}
            fill="var(--primary)"
            initial={false}
            animate={{ cx: dotX, cy: dotY }}
            transition={{ type: "spring", stiffness: 160, damping: 20 }}
            style={{ filter: "drop-shadow(0 0 10px rgb(236 178 94 / 0.8))" }}
          />
        </svg>
        <Range
          label={copy.year.replace("{year}", String(year))}
          value={year}
          min={FIRST}
          max={FIRST + YEARS}
          onChange={setYear}
          display={year}
        />
      </div>
      <div className="flex flex-col gap-5">
        <div className="relative h-44 overflow-hidden rounded-[1.5rem] border border-white/10 bg-white/[0.04]">
          <m.div
            className="absolute inset-x-0 bottom-0 bg-[linear-gradient(to_top,rgb(236_178_94/0.85),rgb(236_178_94/0.35))]"
            animate={{ height: `${share * 100}%` }}
            transition={{ type: "spring", stiffness: 120, damping: 20 }}
          />
          <span className="absolute left-4 top-4 font-mono text-sm text-marketing-ink">
            {Math.round(share * 100)} %
          </span>
        </div>
        <div className="flex justify-between gap-4 text-sm">
          <span>
            <span className="block text-marketing-muted">{copy.yours}</span>
            <Count
              value={yours}
              format={(value) => euro(Math.round(value / 100) * 100)}
              className="font-mono text-primary"
            />
          </span>
          <span className="text-right">
            <span className="block text-marketing-muted">{copy.owed}</span>
            <Count
              value={owed}
              format={(value) => euro(Math.round(value / 100) * 100)}
              className="font-mono text-marketing-ink"
            />
          </span>
        </div>
      </div>
    </div>
  );
}

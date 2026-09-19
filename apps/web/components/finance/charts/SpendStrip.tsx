"use client";

import { useFormatCurrency } from "@/lib/use-currency";
import { useT } from "@/lib/locale-context";
import { PrivateAmount } from "@/components/layout/PrivateAmount";
import type { CategoryBreakdown } from "@finance/core/types/database";

interface SpendStripProps {
  rows: CategoryBreakdown[];
  total: number;
  /** How many categories get their own band before the rest are pooled. */
  bands?: number;
}

/** The chart tokens, in the order the palette was verified in. */
const SERIES = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

/**
 * Where the month went, as one bar.
 *
 * This replaces the Sankey on this screen. A Sankey draws flow — it earns its
 * complexity when money moves through several stages — and here there is only
 * one stage: it went out, into categories. The strip says that in a tenth of
 * the pixels and none of the JavaScript, and it stays readable at the width of
 * a phone, which the Sankey never did.
 *
 * Five bands and a remainder, because a band thinner than a couple of percent
 * is a colour nobody can match to a legend.
 *
 * Every word here is a key and every amount sits in a `PrivateAmount`,
 * including the pooled tail's label and the bar's own description for a
 * screen reader. Those were English in the source and legible through privacy
 * mode until this commit; the rule on this project is that a surface we touch
 * goes through the catalogues and the wrapper whole, and a chart drawn on
 * three screens is three surfaces.
 */
export function SpendStrip({ rows, total, bands = 5 }: SpendStripProps) {
  const formatMoney = useFormatCurrency();
  const t = useT();

  if (total <= 0 || rows.length === 0) {
    return null;
  }

  const sorted = [...rows].sort((a, b) => b.total - a.total);
  const head = sorted.slice(0, bands);
  const rest = sorted.slice(bands);
  const restTotal = rest.reduce((sum, row) => sum + row.total, 0);

  const segments = [
    ...head.map((row, index) => ({
      key: row.categoryId,
      name: row.name,
      amount: row.total,
      color: SERIES[index % SERIES.length]!,
    })),
    ...(restTotal > 0
      ? [
          {
            key: "rest",
            name: t("spendStrip.more", { count: rest.length }),
            amount: restTotal,
            color: "var(--muted-foreground)",
          },
        ]
      : []),
  ];

  return (
    <div className="flex flex-col gap-3">
      <div
        className="flex h-2.5 w-full overflow-hidden rounded-full"
        role="img"
        aria-label={t("spendStrip.label", { count: segments.length })}
      >
        {segments.map((segment) => (
          <div
            key={segment.key}
            style={{
              width: `${(segment.amount / total) * 100}%`,
              backgroundColor: segment.color,
            }}
          />
        ))}
      </div>

      <ul className="flex flex-col gap-1.5">
        {segments.map((segment) => (
          <li
            key={segment.key}
            className="flex items-baseline justify-between gap-3 text-sm"
          >
            <span className="flex min-w-0 items-center gap-2">
              <span
                aria-hidden
                className="size-2 shrink-0 rounded-full"
                style={{ backgroundColor: segment.color }}
              />
              <span className="truncate text-muted-foreground">
                {segment.name}
              </span>
            </span>
            <PrivateAmount className="shrink-0">
              {formatMoney(segment.amount)}
            </PrivateAmount>
          </li>
        ))}
      </ul>
    </div>
  );
}

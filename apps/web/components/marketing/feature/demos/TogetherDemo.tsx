"use client";

import { useState } from "react";
import { m } from "motion/react";
import { landingSampleFor } from "@/components/marketing/landing-sample";
import type { LocalisedLandingCopy } from "@/components/marketing/landing-copy";
import { useLocale, useT } from "@/lib/locale-context";
import { useFormatCurrency } from "@/lib/use-currency";
import { Count, Range } from "./parts";

type Copy = LocalisedLandingCopy["demos"]["together"];

/**
 * The split of the joint spending, dragged: two partners whose circles
 * swell and shrink with their part, the bar between them, and each one's
 * amount following.
 */
export function TogetherDemo({ copy }: { copy: Copy }) {
  const t = useT();
  const euro = useFormatCurrency();
  const { together } = landingSampleFor(useLocale());
  const [share, setShare] = useState(50);
  const mine = (together.spent * share) / 100;

  return (
    <div className="flex flex-col gap-10">
      <div className="flex items-center justify-between gap-6">
        <Partner
          initial="A"
          share={share}
          label={t("space.shareYou", { part: `${share} %` })}
          amount={mine}
        />
        <div className="flex-1">
          <p className="text-center text-xs text-marketing-faint">
            {copy.spent}
          </p>
          <p className="text-center font-serif text-3xl font-semibold text-marketing-ink">
            {euro(together.spent)}
          </p>
          <div className="mt-4 flex h-3 overflow-hidden rounded-full">
            <m.div
              className="bg-primary"
              animate={{ width: `${share}%` }}
              transition={{ type: "spring", stiffness: 160, damping: 24 }}
            />
            <div className="flex-1 bg-white/20" />
          </div>
        </div>
        <Partner
          initial="B"
          share={100 - share}
          label={t("space.sharePartner", {
            name: "B.",
            part: `${100 - share} %`,
          })}
          amount={together.spent - mine}
        />
      </div>
      <Range
        label={t("space.shareRow")}
        value={share}
        min={20}
        max={80}
        onChange={setShare}
        display={`${share} / ${100 - share}`}
      />
    </div>
  );
}

function Partner({
  initial,
  share,
  label,
  amount,
}: {
  initial: string;
  share: number;
  label: string;
  amount: number;
}) {
  const euro = useFormatCurrency();
  return (
    <div className="flex w-28 flex-col items-center gap-3 text-center">
      <m.span
        className="flex items-center justify-center rounded-full border border-white/15 bg-[radial-gradient(circle_at_30%_30%,rgba(255,255,255,0.18),rgba(255,255,255,0.03))] font-semibold text-marketing-ink"
        animate={{ width: 40 + share * 0.9, height: 40 + share * 0.9 }}
        transition={{ type: "spring", stiffness: 180, damping: 18 }}
      >
        {initial}
      </m.span>
      <span className="text-xs text-marketing-muted">{label}</span>
      <Count
        value={amount}
        format={(value) => euro(Math.round(value))}
        className="font-mono text-sm text-marketing-ink"
      />
    </div>
  );
}

"use client";

import { useState } from "react";
import { m } from "motion/react";
import { formatDayMonth } from "@finance/core/constants";
import { landingSampleFor } from "@/components/marketing/landing-sample";
import { useLocale, useT } from "@/lib/locale-context";
import { useFormatCurrency } from "@/lib/use-currency";
import { Chip, Count, Range } from "./parts";

/** What a month's income leaves once its recurring charges are out. */
const EACH_MONTH = 1968;
/** The days « Il vous reste » covers in the sample, to the eve of pay day. */
const DAYS = 15;

/** Split a catalogue sentence around its `{amount}`, to put a live figure in. */
function around(template: string) {
  const [before, after = ""] = template.split("{amount}");
  return { before: before ?? "", after };
}

/**
 * « Puis-je me permettre ? », played: an amount on a slider, once or every
 * month, and the figure answering as it moves — the gold run of what is left
 * shrinking from the right. Nothing is saved, as in the app.
 */
export function BearingDemo() {
  const t = useT();
  const locale = useLocale();
  const euro = useFormatCurrency();
  const { leftToSpend } = landingSampleFor(locale);
  const [amount, setAmount] = useState(180);
  const [monthly, setMonthly] = useState(false);

  const left = leftToSpend.amount - amount;
  const short = left < 0;
  const until = t("leftToSpend.untilPayDay", {
    date: formatDayMonth(leftToSpend.through, locale),
  });
  const sentence = around(
    t(short ? "afford.missingAfter" : "afford.leftAfter", {
      amount: "{amount}",
      until,
    }),
  );
  const monthSentence = around(
    t("afford.eachMonthAfter", { amount: "{amount}" }),
  );
  const kept = Math.max(0, left) / leftToSpend.amount;

  return (
    <div className="grid gap-10 md:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] md:items-center">
      <div className="flex flex-col gap-6">
        <Range
          label={t("afford.amount")}
          value={amount}
          min={0}
          max={2000}
          step={10}
          onChange={setAmount}
          display={euro(amount)}
        />
        <div
          className="flex gap-2"
          role="group"
          aria-label={t("afford.cadence")}
        >
          <Chip active={!monthly} onClick={() => setMonthly(false)}>
            {t("afford.once")}
          </Chip>
          <Chip active={monthly} onClick={() => setMonthly(true)}>
            {t("afford.monthly")}
          </Chip>
        </div>
        <p className="text-xs text-marketing-faint">
          {t("afford.nothingSaved")}
        </p>
      </div>

      <div aria-live="polite">
        <p className="text-lg text-marketing-muted">{sentence.before.trim()}</p>
        <p className="mt-1 font-serif text-[clamp(3rem,8vw,5.5rem)] font-semibold leading-none tracking-[-0.035em]">
          <Count
            value={Math.abs(left)}
            format={(value) => euro(Math.round(value))}
            className={short ? "text-marketing-ink" : "text-primary"}
          />
        </p>
        <p className="mt-2 text-base text-marketing-ink">
          {sentence.after.trim()}
        </p>
        <div className="mt-6 h-2 overflow-hidden rounded-full bg-white/10">
          <m.div
            className="h-full origin-left rounded-full bg-primary"
            animate={{ scaleX: kept }}
            transition={{ type: "spring", stiffness: 140, damping: 22 }}
          />
        </div>
        <p className="mt-3 text-sm text-marketing-muted">
          {t("leftToSpend.perDay", {
            amount: euro(Math.max(0, Math.round(left / DAYS))),
          })}
        </p>
        {monthly ? (
          <m.p
            className="mt-4 text-sm text-marketing-ink"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
          >
            {monthSentence.before}
            <Count
              value={EACH_MONTH - amount}
              format={(value) => euro(Math.round(value))}
              className="font-mono"
            />
            {monthSentence.after}
          </m.p>
        ) : null}
      </div>
    </div>
  );
}

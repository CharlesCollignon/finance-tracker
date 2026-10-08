"use client";

import { useId, useState } from "react";
import { affordAnswer, type AffordCadence } from "@finance/core/afford";
import { parseTypedAmount } from "@finance/core/amount-input";
import { formatDayMonth, formatShortDate } from "@finance/core/constants";
import type { Locale } from "@finance/core/i18n/locale";
import type { LeftToSpend } from "@finance/core/left-to-spend";
import { AnimatedAmount } from "@/components/finance/AnimatedAmount";
import { PrivateAmount } from "@/components/layout/PrivateAmount";
import { Input } from "@/components/ui/Input";
import { MobileSheet } from "@/components/ui/MobileSheet";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { recordAffordAsked } from "@/lib/actions/setup";
import { GLASS_CARD } from "@/lib/glass";
import { FIGURE_HERO } from "@/lib/type-scale";
import { useFormatCurrency } from "@/lib/use-currency";
import { cn } from "@/lib/utils";
import { useLocale, useT } from "@/lib/locale-context";

type T = ReturnType<typeof useT>;

/** "jusqu'au 28 oct." — or, for what is missing, "d'ici le 28 oct.". */
function untilLabel(
  t: T,
  locale: Locale,
  payDay: string | null,
  short: boolean,
): string {
  return payDay
    ? t(short ? "leftToSpend.byPayDay" : "leftToSpend.untilPayDay", {
        date: formatDayMonth(payDay, locale),
      })
    : t(short ? "leftToSpend.byMonthEnd" : "leftToSpend.untilMonthEnd");
}

/**
 * « Il vous reste » — the first thing on Le point: what the account can
 * still give before the next pay day, with the charges due by then and the
 * marge already taken off (`@finance/core/left-to-spend`).
 *
 * Below zero it says what is missing, in the ordinary colour: the overdraft
 * warning is the alarm, and this is the arithmetic behind it. The figure
 * opens « Puis-je me permettre ? ».
 */
export function LeftToSpendCard({
  left,
  lowest,
  eachMonth,
}: {
  left: LeftToSpend;
  /** The balance's lowest point from today, for the question's answer. */
  lowest: { date: string; value: number } | null;
  /** « Reste chaque mois », for a monthly one; null without an income. */
  eachMonth: number | null;
}) {
  const t = useT();
  const locale = useLocale();
  const format = useFormatCurrency();
  const [asking, setAsking] = useState(false);
  const short = left.amount < 0;

  return (
    <section
      className={cn(GLASS_CARD, "flex flex-col gap-2 rounded-card p-card")}
    >
      <button
        type="button"
        onClick={() => {
          setAsking(true);
          void recordAffordAsked();
        }}
        className="-m-2 flex flex-col items-start gap-2 rounded-control p-2 text-left transition-colors duration-hover hover:bg-muted/40"
      >
        <span className="text-sm font-medium text-muted-foreground">
          {t(short ? "leftToSpend.missing" : "leftToSpend.title")}
        </span>
        <AnimatedAmount
          value={Math.abs(left.amount)}
          format={format}
          className={cn(FIGURE_HERO, "block")}
        />
        <span className="text-sm text-muted-foreground">
          {untilLabel(t, locale, left.payDay, short)}
          {left.perDay !== null ? (
            <>
              {" · "}
              <PrivateAmount>
                {t("leftToSpend.perDay", { amount: format(left.perDay) })}
              </PrivateAmount>
            </>
          ) : null}
        </span>
        <span className="text-sm font-medium text-foreground underline decoration-dotted underline-offset-4">
          {t("afford.title")}
        </span>
      </button>
      {/* Native disclosure: keyboard, screen reader and the open state are
          the browser's. */}
      <details className="text-xs text-muted-foreground">
        <summary className="cursor-pointer list-none underline decoration-dotted underline-offset-4 transition-colors duration-hover hover:text-foreground [&::-webkit-details-marker]:hidden">
          {t("leftToSpend.how.title")}
        </summary>
        <div className="mt-2 flex max-w-prose flex-col gap-1.5 leading-relaxed">
          <p>{t("leftToSpend.how.body")}</p>
          <p>
            {t(
              left.payDay
                ? "leftToSpend.how.payDay"
                : "leftToSpend.how.monthEnd",
            )}
          </p>
          {left.marge > 0 ? (
            <p>
              <PrivateAmount>
                {t("leftToSpend.how.marge", {
                  count: left.days,
                  amount: format(left.marge),
                })}
              </PrivateAmount>
            </p>
          ) : null}
        </div>
      </details>

      <MobileSheet
        open={asking}
        onOpenChange={setAsking}
        title={t("afford.title")}
      >
        {asking ? (
          <AffordForm left={left} lowest={lowest} eachMonth={eachMonth} />
        ) : null}
      </MobileSheet>
    </section>
  );
}

/** An amount, how often, and what it would leave. Nothing is saved. */
function AffordForm({
  left,
  lowest,
  eachMonth,
}: {
  left: LeftToSpend;
  lowest: { date: string; value: number } | null;
  eachMonth: number | null;
}) {
  const t = useT();
  const locale = useLocale();
  const format = useFormatCurrency();
  const fieldId = useId();
  const [value, setValue] = useState("");
  const [cadence, setCadence] = useState<AffordCadence>("once");
  const amount = parseTypedAmount(value);
  const answer =
    amount !== null && amount > 0
      ? affordAnswer({ left, lowest, eachMonth, amount, cadence })
      : null;
  const short = answer !== null && answer.leftAfter < 0;

  return (
    <div className="flex flex-col gap-4">
      <label htmlFor={fieldId} className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">{t("afford.amount")}</span>
        <Input
          id={fieldId}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          placeholder={t("monthClose.balancePlaceholder")}
          value={value}
          onChange={(event) => setValue(event.target.value)}
        />
      </label>
      <SegmentedControl
        label={t("afford.cadence")}
        segments={[
          { value: "once", label: t("afford.once") },
          { value: "monthly", label: t("afford.monthly") },
        ]}
        value={cadence}
        onChange={setCadence}
      />
      {/* Polite: the answer changes as the amount is typed, and is read
          out once it settles rather than on every key. */}
      <div aria-live="polite" className="flex flex-col gap-2">
        {answer ? (
          <>
            <p className="text-base font-semibold">
              <PrivateAmount>
                {t(short ? "afford.missingAfter" : "afford.leftAfter", {
                  amount: format(Math.abs(answer.leftAfter)),
                  until: untilLabel(t, locale, left.payDay, short),
                })}
              </PrivateAmount>
            </p>
            {answer.lowestAfter ? (
              <p
                className={cn(
                  "text-sm",
                  answer.lowestAfter.value < 0
                    ? "text-destructive"
                    : "text-muted-foreground",
                )}
              >
                <PrivateAmount>
                  {t("afford.lowestAfter", {
                    amount: format(answer.lowestAfter.value),
                    date: formatShortDate(answer.lowestAfter.date, locale),
                  })}
                </PrivateAmount>
              </p>
            ) : null}
            {answer.eachMonthAfter !== null ? (
              <p className="text-sm text-muted-foreground">
                <PrivateAmount>
                  {t("afford.eachMonthAfter", {
                    amount: format(answer.eachMonthAfter),
                  })}
                </PrivateAmount>
              </p>
            ) : null}
          </>
        ) : null}
      </div>
      <p className="text-xs text-muted-foreground">
        {t("afford.nothingSaved")}
      </p>
    </div>
  );
}

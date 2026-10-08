"use client";

import { useId, useState } from "react";
import { affordAnswer, type AffordCadence } from "@finance/core/afford";
import { parseTypedAmount } from "@finance/core/amount-input";
import { formatDayMonth, formatShortDate } from "@finance/core/constants";
import type { Locale } from "@finance/core/i18n/locale";
import type { LeftToSpend } from "@finance/core/left-to-spend";
import { CaretRight } from "@phosphor-icons/react";
import { PrivateAmount } from "@/components/layout/PrivateAmount";
import { Input } from "@/components/ui/Input";
import { MobileSheet } from "@/components/ui/MobileSheet";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { recordAffordAsked } from "@/lib/actions/setup";
import { ICON } from "@/lib/icon-scale";
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
 * « Il vous reste », one line in the balance card, between its figures and
 * its curve: what the account can still give before the next pay day, with
 * the charges due by then and the marge already taken off
 * (`@finance/core/left-to-spend`).
 *
 * Below zero it says what is missing, in the ordinary colour: the overdraft
 * warning is the alarm, and this is the arithmetic behind it. The line opens
 * « Puis-je me permettre ? », where « Comment c'est calculé ? » waits too, so
 * the card itself stays one sentence.
 */
export function LeftToSpendLine({
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
    <>
      <button
        type="button"
        onClick={() => {
          setAsking(true);
          void recordAffordAsked();
        }}
        className="flex w-full items-center justify-between gap-3 rounded-control border border-border px-3 py-2.5 text-left text-sm transition-colors duration-hover hover:bg-muted/40"
      >
        <span className="min-w-0 text-muted-foreground">
          {t(short ? "leftToSpend.missing" : "leftToSpend.title")}{" "}
          <PrivateAmount className="font-semibold text-foreground tabular-nums">
            {format(Math.abs(left.amount))}
          </PrivateAmount>{" "}
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
        <CaretRight
          size={ICON.sm}
          className="shrink-0 text-muted-foreground"
          aria-hidden
        />
        <span className="sr-only">{t("afford.title")}</span>
      </button>

      <MobileSheet
        open={asking}
        onOpenChange={setAsking}
        title={t("afford.title")}
      >
        {asking ? (
          <div className="flex flex-col gap-5">
            <AffordForm left={left} lowest={lowest} eachMonth={eachMonth} />
            {/* Native disclosure: keyboard, screen reader and the open
                state are the browser's. */}
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
          </div>
        ) : null}
      </MobileSheet>
    </>
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

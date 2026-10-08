"use client";

import { formatDayMonth } from "@finance/core/constants";
import type { LeftToSpend } from "@finance/core/left-to-spend";
import { AnimatedAmount } from "@/components/finance/AnimatedAmount";
import { PrivateAmount } from "@/components/layout/PrivateAmount";
import { GLASS_CARD } from "@/lib/glass";
import { FIGURE_HERO } from "@/lib/type-scale";
import { useFormatCurrency } from "@/lib/use-currency";
import { cn } from "@/lib/utils";
import { useLocale, useT } from "@/lib/locale-context";

/**
 * « Il vous reste » — the first thing on Le point: what the account can
 * still give before the next pay day, with the charges due by then and the
 * marge already taken off (`@finance/core/left-to-spend`).
 *
 * Below zero it says what is missing, in the ordinary colour: the overdraft
 * warning is the alarm, and this is the arithmetic behind it.
 */
export function LeftToSpendCard({ left }: { left: LeftToSpend }) {
  const t = useT();
  const locale = useLocale();
  const format = useFormatCurrency();
  const short = left.amount < 0;
  const until = left.payDay
    ? t(short ? "leftToSpend.byPayDay" : "leftToSpend.untilPayDay", {
        date: formatDayMonth(left.payDay, locale),
      })
    : t(short ? "leftToSpend.byMonthEnd" : "leftToSpend.untilMonthEnd");

  return (
    <section
      className={cn(GLASS_CARD, "flex flex-col gap-2 rounded-card p-card")}
    >
      <p className="text-sm font-medium text-muted-foreground">
        {t(short ? "leftToSpend.missing" : "leftToSpend.title")}
      </p>
      <AnimatedAmount
        value={Math.abs(left.amount)}
        format={format}
        className={cn(FIGURE_HERO, "block")}
      />
      <p className="text-sm text-muted-foreground">
        {until}
        {left.perDay !== null ? (
          <>
            {" · "}
            <PrivateAmount>
              {t("leftToSpend.perDay", { amount: format(left.perDay) })}
            </PrivateAmount>
          </>
        ) : null}
      </p>
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
    </section>
  );
}

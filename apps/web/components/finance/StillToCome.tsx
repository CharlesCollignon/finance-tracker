"use client";

import Link from "next/link";
import { ArrowRight } from "@phosphor-icons/react";
import { formatShortDate, relativeDayLabel } from "@finance/core/constants";
import type { UpcomingCharge } from "@finance/core/still-to-come";
import { TYPE_AMOUNT_CLASS } from "@finance/core/category-styles";
import { PrivateAmount } from "@/components/layout/PrivateAmount";
import { cn } from "@/lib/utils";
import { useFormatCurrency } from "@/lib/use-currency";

interface StillToComeProps {
  /** What is still due to leave, soonest first. */
  outgoing: UpcomingCharge[];
  /** Their sum: the header figure, so the list adds up to what it says. */
  leaving: number;
  /** What is still due to arrive, summarised under the list. */
  incoming: UpcomingCharge[];
  arriving: number;
  /** How many get their own row before the rest are pooled. */
  rows?: number;
}

/**
 * What the rest of the month still owes.
 *
 * The month has always been able to say this as one number — the month-end
 * view is exactly this projection run to the last day — but a number cannot
 * answer the question people actually have, which is whether the next big one
 * lands before or after payday. So it lists them, soonest first.
 *
 * Deliberately short. Six rows and a remainder is a glance; the full shape of
 * the month is the calendar, which is a click away and better at it.
 */
export function StillToCome({
  outgoing,
  leaving,
  incoming,
  arriving,
  rows = 6,
}: StillToComeProps) {
  const formatMoney = useFormatCurrency();

  if (outgoing.length === 0 && incoming.length === 0) {
    return null;
  }

  const head = outgoing.slice(0, rows);
  const rest = outgoing.slice(rows);
  const restTotal = rest.reduce((sum, charge) => sum + charge.amount, 0);

  return (
    <section className="flex flex-col gap-4 rounded-xl border border-border bg-card p-5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-medium">Still to come</h2>
        <PrivateAmount className="tabular-nums">
          {formatMoney(leaving)}
        </PrivateAmount>
      </div>

      <ul className="flex flex-col">
        {head.map((charge) => (
          <li
            key={charge.key}
            className="flex items-baseline justify-between gap-3 border-b border-border py-2 text-sm last:border-0"
          >
            <span className="flex min-w-0 flex-1 items-baseline gap-3">
              <span className="w-20 shrink-0 text-xs text-muted-foreground">
                {relativeDayLabel(charge.occurredOn, formatShortDate)}
              </span>
              <span className="min-w-0 flex-1 truncate">
                {charge.name}
                {charge.description ? (
                  <span className="text-muted-foreground">
                    {` · ${charge.description}`}
                  </span>
                ) : null}
              </span>
            </span>
            <PrivateAmount
              className={cn(
                "shrink-0 tabular-nums",
                TYPE_AMOUNT_CLASS[charge.type],
              )}
            >
              {formatMoney(charge.amount)}
            </PrivateAmount>
          </li>
        ))}
        {rest.length > 0 ? (
          <li className="flex items-baseline justify-between gap-3 py-2 text-sm text-muted-foreground">
            <span>{`${rest.length} more`}</span>
            <PrivateAmount className="tabular-nums">
              {formatMoney(restTotal)}
            </PrivateAmount>
          </li>
        ) : null}
      </ul>

      {/* Money coming in is not "still to come" in the sense the figure above
          means, but knowing whether payday lands before the big debit is half
          the reason to look at this at all. */}
      {arriving > 0 ? (
        <p className="text-sm text-muted-foreground">
          <PrivateAmount className="tabular-nums text-success">
            {`+${formatMoney(arriving)}`}
          </PrivateAmount>
          {" still to arrive"}
          {incoming.length === 1 && incoming[0]
            ? `, ${incoming[0].name} on ${relativeDayLabel(incoming[0].occurredOn, formatShortDate)}`
            : ""}
        </p>
      ) : null}

      <Link
        href="/calendar"
        className="flex w-fit items-center gap-1 text-sm text-primary-ink"
      >
        See the month on a calendar
        <ArrowRight size={13} />
      </Link>
    </section>
  );
}

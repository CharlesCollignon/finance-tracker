"use client";

import Link from "next/link";
import { ArrowRight } from "@phosphor-icons/react";
import { formatShortDate, relativeDayLabel } from "@finance/core/constants";
import type { BankMovement } from "@/lib/queries/bank";
import { PrivateAmount } from "@/components/layout/PrivateAmount";
import { cn } from "@/lib/utils";
import { GLASS_CARD } from "@/lib/glass";
import { useFormatCurrency } from "@/lib/use-currency";

interface RecentOnAccountProps {
  movements: BankMovement[];
  /** How many are still waiting for a category, for the link to say so. */
  pending: number;
}

/**
 * The last things that actually happened to the account.
 *
 * Every other block on this screen is derived — a sum, a projection, a
 * reconciliation — and a derived figure is exactly what someone doubts when
 * they are wondering whether the app has noticed the card payment they made
 * an hour ago. This is the statement itself, newest first, in the bank's own
 * words.
 *
 * Which is why the pending rows are here too. Filtering to what has been
 * filed would hide the one row that answers the question: the coffee from
 * this morning, still waiting for a category, is the evidence that the
 * refresh worked. It is marked rather than dressed up as filed.
 *
 * Money in reads green and money out red, on the bank's own direction rather
 * than the category's colour — half these rows have no category yet, and the
 * one thing the bank has already told us is which way the money went.
 */
export function RecentOnAccount({ movements, pending }: RecentOnAccountProps) {
  const formatMoney = useFormatCurrency();

  if (movements.length === 0) {
    return null;
  }

  return (
    <section className={cn("flex flex-col gap-4 rounded-3xl p-5", GLASS_CARD)}>
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-medium">Last on your account</h2>
        <Link
          href="/transactions"
          className="flex shrink-0 items-center gap-1 text-sm text-primary-ink"
        >
          {pending > 0 ? `${pending} to review` : "Ledger"}
          <ArrowRight size={13} />
        </Link>
      </div>

      <ul className="flex flex-col">
        {movements.map((movement) => (
          <li
            key={movement.id}
            className="flex items-baseline justify-between gap-3 border-b border-foreground/10 py-2 text-sm last:border-0"
          >
            <span className="flex min-w-0 flex-1 items-baseline gap-3">
              <span className="w-20 shrink-0 text-xs text-muted-foreground">
                {relativeDayLabel(movement.occurredOn, formatShortDate)}
              </span>
              <span className="min-w-0 flex-1">
                {/* Truncated here, unlike the review inbox, where the whole
                    bank string is the decision. Here the row is a receipt:
                    the reader already knows what they bought. */}
                <span className="block truncate">{movement.label}</span>
                <span className="block truncate text-xs text-muted-foreground">
                  {movement.pending
                    ? "waiting for a category"
                    : movement.ignored
                      ? "left out"
                      : (movement.categoryName ?? "in your ledger")}
                </span>
              </span>
            </span>
            <PrivateAmount
              className={cn(
                "shrink-0 tabular-nums",
                movement.direction === "in"
                  ? "text-success"
                  : "text-destructive",
                // A row nobody has filed is not yet part of the month's
                // figures, and the amount should not read as though it were.
                movement.pending && "opacity-70",
              )}
            >
              {`${movement.direction === "in" ? "+" : "−"}${formatMoney(
                movement.amount,
              )}`}
            </PrivateAmount>
          </li>
        ))}
      </ul>
    </section>
  );
}

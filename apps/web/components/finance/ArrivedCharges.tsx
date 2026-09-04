"use client";

import { useState, useTransition } from "react";
import { Check, X } from "@phosphor-icons/react";
import {
  describeFulfilment,
  describeMiss,
  type FulfilmentMiss,
  type FulfilmentProposal,
} from "@finance/core/recurring-fulfilment";
import { formatShortDate, relativeDayLabel } from "@finance/core/constants";
import { fulfilOccurrence, refuseFulfilment } from "@/lib/actions/fulfilment";
import { useToast } from "@/components/layout/ToastProvider";
import { PrivateAmount } from "@/components/layout/PrivateAmount";
import { cn } from "@/lib/utils";
import { useFormatCurrency } from "@/lib/use-currency";

interface ArrivedChargesProps {
  proposals: FulfilmentProposal[];
  /**
   * Occurrences that were not offered, and why.
   *
   * Shown because the first report of this feature in use was "there are two
   * identical charges in my ledger and neither was proposed" — with no way to
   * tell whether that was the amount, the date, the category, or a template
   * with no occurrence this month at all. Narrow thresholds are right; a
   * narrow matcher that says nothing is indistinguishable from a broken one.
   */
  misses?: FulfilmentMiss[];
}

/**
 * "Did this arrive?" — the one question the app cannot answer for itself.
 *
 * A recurring template says €780 leaves on the 5th. The bank says €780 left
 * on the 4th. Whether those are the same rent is a judgement, and getting it
 * wrong in either direction is expensive: call them the same when they are
 * not and a real payment disappears from the forecast; call them different
 * and the month counts the rent twice, which on a salary means a whole
 * month's income added to a figure the user is about to spend against.
 *
 * So it is asked, every time. This app already tried the other way — matching
 * on amount and a five-day window — and had to grow a "put back what was
 * merged away" action for the damage. The thresholds behind these rows are
 * tuned to make the questions few, not to make the guessing clever.
 *
 * Answered rows leave immediately rather than waiting for the server. The
 * decision is recorded either way and a failure is toasted, so the optimistic
 * removal costs nothing and the list does not sit there looking unresponsive
 * through a round trip.
 */
export function ArrivedCharges({
  proposals,
  misses = [],
}: ArrivedChargesProps) {
  const { toast } = useToast();
  const formatMoney = useFormatCurrency();
  const [pending, startTransition] = useTransition();
  const [answered, setAnswered] = useState<Set<string>>(new Set());

  const [showMisses, setShowMisses] = useState(false);
  const waiting = proposals.filter((proposal) => !answered.has(proposal.key));

  // The misses alone are not worth a block. They explain an absence, and an
  // absence is only a question once something else has been offered.
  if (waiting.length === 0) {
    return null;
  }

  function answer(
    proposal: FulfilmentProposal,
    work: () => Promise<{ error?: string; message?: string }>,
  ) {
    setAnswered((current) => new Set(current).add(proposal.key));
    startTransition(async () => {
      const result = await work();
      if (result.error) {
        // Put it back: the decision did not stick, and a row that vanished
        // without being recorded is how a charge silently keeps its forecast.
        setAnswered((current) => {
          const next = new Set(current);
          next.delete(proposal.key);
          return next;
        });
        toast(result.error, "error");
        return;
      }
      toast(result.message ?? "Done", "success");
    });
  }

  return (
    <section
      aria-label="Charges that look like they arrived"
      className="flex flex-col"
    >
      <h3 className="border-b border-foreground/10 px-4 py-2.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {waiting.length === 1 ? "Did this arrive?" : "Did these arrive?"}
      </h3>

      <ul className="flex flex-col">
        {waiting.map((proposal) => {
          const income = proposal.categoryType === "income";
          return (
            <li
              key={proposal.key}
              className="flex flex-col gap-2 border-b border-foreground/10 px-4 py-3 last:border-0 sm:flex-row sm:items-center sm:gap-3"
            >
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-baseline gap-x-2 text-sm">
                  <span className="font-medium">{proposal.label}</span>
                  <PrivateAmount
                    className={cn(
                      "tabular-nums",
                      income ? "text-success" : "text-destructive",
                    )}
                  >
                    {`${income ? "+" : "−"}${formatMoney(proposal.actualAmount)}`}
                  </PrivateAmount>
                  <span className="text-muted-foreground">
                    {relativeDayLabel(proposal.actualOn, formatShortDate)}
                  </span>
                </p>
                {/* The bank's own words, so the row is recognisable as the
                    thing on the statement rather than as our summary of it. */}
                {proposal.actualNote ? (
                  <p className="truncate text-xs text-muted-foreground">
                    {proposal.actualNote}
                  </p>
                ) : null}
                <p className="text-xs text-muted-foreground">
                  {describeFulfilment(proposal, formatMoney)}
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  disabled={pending}
                  onClick={() =>
                    answer(proposal, () =>
                      fulfilOccurrence(
                        proposal.templateId,
                        proposal.occurredOn,
                        proposal.transactionId,
                      ),
                    )
                  }
                  className={cn(
                    "inline-flex min-h-9 items-center gap-1.5 rounded-full px-3 text-sm font-medium",
                    "bg-primary text-primary-foreground",
                    "transition-colors hover:bg-primary-hover",
                    "disabled:opacity-60",
                  )}
                >
                  <Check size={14} weight="bold" />
                  That&apos;s it
                </button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() =>
                    answer(proposal, () =>
                      refuseFulfilment(
                        proposal.templateId,
                        proposal.occurredOn,
                        proposal.transactionId,
                      ),
                    )
                  }
                  className={cn(
                    "inline-flex min-h-9 items-center gap-1.5 rounded-full px-3 text-sm",
                    "text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
                    "disabled:opacity-60",
                  )}
                >
                  <X size={14} />
                  Not it
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      {misses.length > 0 ? (
        <div className="border-t border-foreground/10 px-4 py-2.5">
          <button
            type="button"
            onClick={() => setShowMisses((current) => !current)}
            aria-expanded={showMisses}
            className="text-xs text-muted-foreground underline decoration-dotted underline-offset-2 hover:text-foreground"
          >
            {showMisses
              ? "Hide what was not offered"
              : `${misses.length} other ${
                  misses.length === 1 ? "charge was" : "charges were"
                } not offered — why?`}
          </button>

          {showMisses ? (
            <ul className="mt-2 flex flex-col gap-1">
              {misses.map((miss) => (
                <li
                  key={miss.key}
                  className="flex flex-wrap items-baseline gap-x-2 text-xs text-muted-foreground"
                >
                  <span className="text-foreground">{miss.label}</span>
                  <PrivateAmount className="tabular-nums">
                    {formatMoney(miss.expectedAmount)}
                  </PrivateAmount>
                  <span>{formatShortDate(miss.occurredOn)}</span>
                  <span>·</span>
                  <span>{describeMiss(miss, formatMoney)}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

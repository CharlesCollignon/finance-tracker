"use client";

import { useState, useTransition } from "react";
import { Check, X } from "@phosphor-icons/react";
import {
  confirmLabel,
  describeFulfilment,
  type FulfilmentProposal,
} from "@finance/core/recurring-fulfilment";
import { formatShortDate, relativeDayLabel } from "@finance/core/constants";
import { fulfilOccurrence, refuseFulfilment } from "@/lib/actions/fulfilment";
import { useToast } from "@/components/layout/ToastProvider";
import { PrivateAmount } from "@/components/layout/PrivateAmount";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import { useFormatCurrency } from "@/lib/use-currency";
import { ICON } from "@/lib/icon-scale";
import { useLocale, useT } from "@/lib/locale-context";

interface ArrivedChargesProps {
  proposals: FulfilmentProposal[];
  /**
   * Called once a decision has actually stuck on the server.
   *
   * The row leaves optimistically, but everything *around* it is stale the
   * moment a proposal is confirmed: a fulfilment rewrites what is still to
   * come, the spend strip and the month in words, all of which are blocks
   * of the same panel this renders in. The panel caches its detail in
   * client state, so a `revalidatePath` on the server does not reach it —
   * whoever mounts this has to ask for the detail again. The phone's twin
   * has taken an `onDecided` since it was written; this is the web catching
   * up.
   */
  onDecided?: () => void;
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
export function ArrivedCharges({ proposals, onDecided }: ArrivedChargesProps) {
  const t = useT();
  const { toast } = useToast();
  const formatMoney = useFormatCurrency();
  const locale = useLocale();
  const [pending, startTransition] = useTransition();
  const [answered, setAnswered] = useState<Set<string>>(new Set());
  // An answer is held only until the server stops offering that pairing. Held
  // longer, it hid the same question when it came back — an early salary
  // moved back to the day it was paid reopens it, and so does an undo on the
  // phone — and the card stayed empty until the page was left.
  const [seenProposals, setSeenProposals] = useState(proposals);
  if (proposals !== seenProposals) {
    setSeenProposals(proposals);
    const offered = new Set(proposals.map((proposal) => proposal.key));
    setAnswered(
      (current) => new Set([...current].filter((key) => offered.has(key))),
    );
  }

  const waiting = proposals.filter((proposal) => !answered.has(proposal.key));

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
      toast(result.message ?? t("fulfilment.done"), "success");
      onDecided?.();
    });
  }

  /**
   * Every waiting pairing at once. A salary paid early usually brings its
   * savings and its broker transfer with it, and three presses of "Compter
   * pour octobre" in a row is one decision asked three times. One at a time,
   * so two confirmations never race for the same row.
   */
  function confirmAll() {
    const batch = waiting;
    setAnswered((current) => {
      const next = new Set(current);
      batch.forEach((proposal) => next.add(proposal.key));
      return next;
    });
    startTransition(async () => {
      let confirmed = 0;
      let firstError: string | null = null;
      const failed: string[] = [];
      for (const proposal of batch) {
        const result = await fulfilOccurrence(
          proposal.templateId,
          proposal.occurredOn,
          proposal.transactionId,
        );
        if (result.error) {
          failed.push(proposal.key);
          firstError ??= result.error;
        } else {
          confirmed += 1;
        }
      }
      if (failed.length > 0) {
        setAnswered((current) => {
          const next = new Set(current);
          failed.forEach((key) => next.delete(key));
          return next;
        });
        toast(firstError!, "error");
      }
      if (confirmed > 0) {
        toast(t("fulfilment.allConfirmed", { count: confirmed }), "success");
        onDecided?.();
      }
    });
  }

  return (
    <section aria-label={t("common.arrivedCharges")} className="flex flex-col">
      {waiting.length > 0 ? (
        <div className="flex items-center justify-between gap-3 border-b border-foreground/10 px-4 py-2">
          <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {t("fulfilment.askTitle", { count: waiting.length })}
          </h3>
          {waiting.length > 1 ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={confirmAll}
              className="gap-1.5 rounded-full"
            >
              <Check size={ICON.sm} weight="bold" />
              {t("fulfilment.confirmAll")}
            </Button>
          ) : null}
        </div>
      ) : null}

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
                    {relativeDayLabel(
                      proposal.actualOn,
                      formatShortDate,
                      locale,
                    )}
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
                  {describeFulfilment(proposal, formatMoney, locale)}
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <Button
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
                  size="sm"
                  className="gap-1.5 rounded-full"
                >
                  <Check size={ICON.sm} weight="bold" />
                  {/* "Compter pour octobre" for a salary paid early for next
                      month, since that is what pressing it does. */}
                  {confirmLabel(proposal, locale)}
                </Button>
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
                  <X size={ICON.sm} />
                  {t("fulfilment.notIt")}
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

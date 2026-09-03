"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/retroui/Button";
import { useToast } from "@/components/layout/ToastProvider";
import { useFormatCurrency } from "@/lib/use-currency";
import {
  acceptRecurringProposal,
  dismissRecurringProposal,
} from "@/lib/actions/bank";
import type { RecurringProposal } from "@finance/core/recurring-detection";

interface RecurringProposalsProps {
  proposals: RecurringProposal[];
}

/**
 * A name to show for a suggestion.
 *
 * The raw statement line is unreadable in a column this narrow — "PRELEVEMENT
 * Navigo Annuel - COMUTITRES SAS" truncates to "PRELEVEMENT Navi…", which
 * says nothing about what is being accepted. The merchant key is what the
 * detector grouped on and is already stripped of the bank's noise, so it
 * makes the better label; the full line stays available on hover and can be
 * edited once the template exists.
 */
function displayName(key: string): string {
  return key
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

const CADENCE: Record<string, string> = {
  weekly: "every week",
  monthly: "every month",
  yearly: "every year",
};

/**
 * Standing charges the statement implies, offered where they belong.
 *
 * A year of transactions already contains every subscription and direct debit
 * the user has, so asking them to type those in from a list the app is
 * looking straight at is work the app should do. It proposes and never
 * creates: a template nobody agreed to joins every projection and every
 * runway figure, and is invisible once it is there.
 *
 * Rendered inside the group for its own kind of money rather than as a banner
 * above the page, so a suggested subscription sits with the subscriptions and
 * nothing is pushed off the top of the screen.
 */
export function RecurringProposals({ proposals }: RecurringProposalsProps) {
  const { toast } = useToast();
  const formatMoney = useFormatCurrency();
  const [pending, startTransition] = useTransition();
  const [gone, setGone] = useState<ReadonlySet<string>>(new Set());

  const visible = proposals.filter((proposal) => !gone.has(proposal.key));
  if (visible.length === 0) {
    return null;
  }

  function hide(key: string) {
    setGone((current) => new Set(current).add(key));
  }

  function accept(key: string) {
    startTransition(async () => {
      const result = await acceptRecurringProposal(key);
      if (result.error) {
        toast(result.error, "error");
        return;
      }
      hide(key);
      toast(result.message ?? "Added", "success");
    });
  }

  function refuse(key: string) {
    // Recorded rather than merely hidden. A refusal that lasts until the next
    // page load is not a refusal, which is exactly how these kept coming back.
    startTransition(async () => {
      const result = await dismissRecurringProposal(key);
      if (result.error) {
        toast(result.error, "error");
        return;
      }
      hide(key);
    });
  }

  return (
    <div className="mb-3 flex flex-col gap-2 rounded-lg border border-dashed border-primary-rim/50 p-3">
      <p className="text-xs text-muted-foreground">
        {visible.length === 1
          ? "One charge in your statement looks like it repeats."
          : `${visible.length} charges in your statement look like they repeat.`}
      </p>

      <ul className="flex flex-col gap-2">
        {visible.map((proposal) => (
          <li
            key={proposal.key}
            className="flex flex-col gap-1.5 rounded-md border border-border/60 p-2"
          >
            <div className="flex items-baseline justify-between gap-2">
              <p
                className="min-w-0 truncate text-sm font-medium"
                title={proposal.label}
              >
                {displayName(proposal.key)}
              </p>
              <span className="shrink-0 tabular-nums text-sm font-semibold">
                {formatMoney(proposal.amount)}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              {CADENCE[proposal.recurrence]} · seen {proposal.count} times
            </p>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                size="sm"
                className="flex-1"
                disabled={pending}
                onClick={() => accept(proposal.key)}
              >
                Add
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={pending}
                onClick={() => refuse(proposal.key)}
              >
                Not this
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

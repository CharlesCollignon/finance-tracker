"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/retroui/Button";
import { Card } from "@/components/retroui/Card";
import { useToast } from "@/components/layout/ToastProvider";
import { useFormatCurrency } from "@/lib/use-currency";
import { acceptRecurringProposal } from "@/lib/actions/bank";
import type { RecurringProposal } from "@finance/core/recurring-detection";

interface RecurringProposalsProps {
  proposals: RecurringProposal[];
}

const CADENCE: Record<string, string> = {
  weekly: "every week",
  monthly: "every month",
  yearly: "every year",
};

/**
 * Standing charges the statement implies.
 *
 * A year of transactions already contains every subscription and every direct
 * debit the user has; asking them to type those in from a list the app is
 * looking straight at is work the app should do. But it proposes and never
 * creates: a template nobody agreed to joins every projection and is
 * invisible once it is there.
 */
export function RecurringProposals({ proposals }: RecurringProposalsProps) {
  const { toast } = useToast();
  const formatMoney = useFormatCurrency();
  const [pending, startTransition] = useTransition();
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const visible = proposals.filter((p) => !dismissed.has(p.key));
  if (visible.length === 0) {
    return null;
  }

  function accept(key: string) {
    startTransition(async () => {
      const result = await acceptRecurringProposal(key);
      if (result.error) {
        toast(result.error, "error");
        return;
      }
      setDismissed((current) => new Set(current).add(key));
      toast(result.message ?? "Added", "success");
    });
  }

  return (
    <Card className="block w-full">
      <Card.Header>
        <Card.Title>These look like standing charges</Card.Title>
        <Card.Description>
          Found in what your account has already done. Adding one makes it part
          of the forecast — the months ahead, the runway and what is still to
          come this month.
        </Card.Description>
      </Card.Header>

      <Card.Content>
        <ul className="flex flex-col gap-2">
          {visible.map((proposal) => (
            <li
              key={proposal.key}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-3"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{proposal.label}</p>
                <p className="text-xs text-muted-foreground">
                  {formatMoney(proposal.amount)} {CADENCE[proposal.recurrence]}
                  {" · seen "}
                  {proposal.count} times · {proposal.categoryName}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Button
                  type="button"
                  size="sm"
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
                  onClick={() =>
                    setDismissed((current) =>
                      new Set(current).add(proposal.key),
                    )
                  }
                >
                  Not this
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </Card.Content>
    </Card>
  );
}

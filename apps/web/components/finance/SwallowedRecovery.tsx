"use client";

import { useTransition } from "react";
import { ArrowCounterClockwise } from "@phosphor-icons/react";
import { Button } from "@/components/retroui/Button";
import { Card } from "@/components/retroui/Card";
import { useToast } from "@/components/layout/ToastProvider";
import { reopenSwallowedFeedItems } from "@/lib/actions/bank";

interface SwallowedRecoveryProps {
  count: number;
}

/**
 * Bank rows an earlier sync merged away on its own.
 *
 * The sync used to treat an amount matching a recurring transaction within
 * five days as proof they were the same movement. On a statement full of
 * small round figures that is not proof of anything — a ten-euro purchase and
 * a ten-euro weekly DCA look identical to it — so those rows were filed
 * against the DCA and never became transactions. They are not duplicates;
 * they are spending that quietly never arrived.
 *
 * Reopening puts every one of them back in the review inbox, where the
 * decision is the user's. Some really were the debit the template predicted,
 * and those can be left out again — but that is a judgement nothing here is
 * entitled to make.
 */
export function SwallowedRecovery({ count }: SwallowedRecoveryProps) {
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();

  if (count === 0) {
    return null;
  }

  function reopen() {
    startTransition(async () => {
      const result = await reopenSwallowedFeedItems();
      toast(
        result.error ?? result.message ?? "Reopened",
        result.error ? "error" : "success",
      );
    });
  }

  return (
    <Card className="block w-full border-destructive/40">
      <Card.Header>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Card.Title>{count} entries were merged away</Card.Title>
          <Button
            type="button"
            size="sm"
            className="gap-2"
            disabled={pending}
            onClick={reopen}
          >
            <ArrowCounterClockwise size={14} />
            {pending ? "Reopening…" : "Reopen them all"}
          </Button>
        </div>
        <Card.Description>
          An earlier sync decided these were debits your recurring templates had
          already written, on nothing more than a matching amount within five
          days. On a statement of small round figures that is not enough to go
          on, so most of them are probably real spending that never reached your
          ledger. Reopening puts them back in the inbox for you to judge.
        </Card.Description>
      </Card.Header>
    </Card>
  );
}

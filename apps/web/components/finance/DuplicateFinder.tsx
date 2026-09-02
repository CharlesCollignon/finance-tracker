"use client";

import { useTransition } from "react";
import { Button } from "@/components/retroui/Button";
import { Card } from "@/components/retroui/Card";
import { useToast } from "@/components/layout/ToastProvider";
import { useFormatCurrency } from "@/lib/use-currency";
import { formatShortDate } from "@finance/core/constants";
import { dropAllFeedDuplicates, dropFeedDuplicate } from "@/lib/actions/bank";
import type { DuplicatePair } from "@/lib/queries/bank";

interface DuplicateFinderProps {
  pairs: DuplicatePair[];
}

/**
 * Copies the feed made of things the ledger already had.
 *
 * These date from before the duplicate check existed, and from when accepting
 * a row out of the inbox bypassed it. Both are closed now, so this list only
 * shrinks — but it has to exist, because once both copies are sitting in the
 * ledger nothing else can tell which one to keep.
 *
 * The bank's copy is always the one dropped: the other came from a standing
 * instruction or from the user's own hand, and it carries the category, the
 * note and the template link that the feed's copy does not.
 */
export function DuplicateFinder({ pairs }: DuplicateFinderProps) {
  const { toast } = useToast();
  const formatMoney = useFormatCurrency();
  const [pending, startTransition] = useTransition();

  if (pairs.length === 0) {
    return null;
  }

  function dropOne(feedItemId: string) {
    startTransition(async () => {
      const result = await dropFeedDuplicate(feedItemId);
      toast(result.error ?? "Removed", result.error ? "error" : "success");
    });
  }

  function dropAll() {
    startTransition(async () => {
      const result = await dropAllFeedDuplicates();
      toast(
        result.error ?? result.message ?? "Removed",
        result.error ? "error" : "success",
      );
    });
  }

  return (
    <Card className="block w-full">
      <Card.Header>
        <div className="flex items-center justify-between gap-3">
          <Card.Title>Recorded twice</Card.Title>
          <Button type="button" size="sm" disabled={pending} onClick={dropAll}>
            {pending
              ? "Removing…"
              : `Drop all ${pairs.length} bank ${pairs.length === 1 ? "copy" : "copies"}`}
          </Button>
        </div>
        <Card.Description>
          The bank reported {pairs.length}{" "}
          {pairs.length === 1 ? "movement" : "movements"} your ledger already
          held. Dropping the bank&rsquo;s copy keeps the one with your category
          and note on it.
        </Card.Description>
      </Card.Header>

      <Card.Content>
        <ul className="flex flex-col gap-3">
          {pairs.map((pair) => (
            <li
              key={pair.feedItemId}
              className="flex flex-col gap-2 rounded-lg border border-border p-3"
            >
              <div className="flex items-baseline justify-between gap-3">
                <span className="tabular-nums text-sm font-semibold">
                  {formatMoney(pair.amount)}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={pending}
                  onClick={() => dropOne(pair.feedItemId)}
                >
                  Drop the bank copy
                </Button>
              </div>

              <div className="flex flex-col gap-1 text-xs">
                <p className="flex flex-wrap items-baseline gap-x-2">
                  <span className="font-medium text-success">Keeping</span>
                  <span className="text-muted-foreground">
                    {formatShortDate(pair.keptOccurredOn)}
                  </span>
                  <span>{pair.keptNote ?? pair.keptCategoryName}</span>
                  <span className="text-muted-foreground">
                    {pair.keptCategoryName}
                    {pair.keptFromRecurring ? " · recurring" : ""}
                  </span>
                </p>
                <p className="flex flex-wrap items-baseline gap-x-2 opacity-60">
                  <span className="font-medium">Dropping</span>
                  <span className="text-muted-foreground">
                    {formatShortDate(pair.bankOccurredOn)}
                  </span>
                  <span className="truncate">{pair.bankNote}</span>
                  <span className="text-muted-foreground">from the bank</span>
                </p>
              </div>
            </li>
          ))}
        </ul>
      </Card.Content>
    </Card>
  );
}

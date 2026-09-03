"use client";

import { useState, useTransition } from "react";
import { ArrowsClockwise } from "@phosphor-icons/react";
import { Button } from "@/components/retroui/Button";
import { MobileSheet } from "@/components/layout/MobileSheet";
import { CategorySelect } from "@/components/finance/CategorySelect";
import { useToast } from "@/components/layout/ToastProvider";
import { useFormatCurrency } from "@/lib/use-currency";
import { formatShortDate } from "@finance/core/constants";
import {
  ignoreFeedItem,
  importFeedItem,
  syncBankFeedAction,
} from "@/lib/actions/bank";
import type { Category } from "@finance/core/types/database";
import type { PendingFeedRow } from "@/lib/queries/bank";

interface BankInboxProps {
  items: PendingFeedRow[];
  categories: Category[];
  /** True until the whole statement has been pulled once. */
  showBackfill: boolean;
}

/**
 * What the bank reported that the app would not file on its own.
 *
 * Everything the user's own history already answered for is in the ledger by
 * the time they see this, so the inbox is the exceptions — a first visit
 * somewhere, money arriving, a cash withdrawal. Answering one teaches the
 * matcher, which is why the list gets shorter every month rather than being a
 * permanent chore.
 */
export function BankInbox({ items, categories, showBackfill }: BankInboxProps) {
  const { toast } = useToast();
  const formatMoney = useFormatCurrency();
  const [pending, startTransition] = useTransition();
  const [choices, setChoices] = useState<Record<string, string>>({});
  const [open, setOpen] = useState(false);

  function sync(backfill = false) {
    startTransition(async () => {
      const result = await syncBankFeedAction(backfill);
      toast(
        result.error ?? result.message ?? "Synced",
        result.error ? "error" : "success",
      );
    });
  }

  function accept(id: string) {
    const categoryId = choices[id];
    if (!categoryId) {
      toast("Pick a category first", "error");
      return;
    }
    startTransition(async () => {
      const result = await importFeedItem(id, categoryId);
      toast(result.error ?? "Added", result.error ? "error" : "success");
    });
  }

  function leaveOut(id: string) {
    startTransition(async () => {
      const result = await ignoreFeedItem(id);
      toast(result.error ?? "Left out", result.error ? "error" : "success");
    });
  }

  const bar = (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card px-4 py-2.5">
      <p className="min-w-0 text-sm">
        {items.length === 0 ? (
          <span className="text-muted-foreground">
            Nothing waiting from your bank.
          </span>
        ) : (
          <>
            <span className="font-medium">{items.length}</span>{" "}
            <span className="text-muted-foreground">
              {items.length === 1 ? "entry needs" : "entries need"} a category
            </span>
          </>
        )}
      </p>
      <div className="flex shrink-0 items-center gap-2">
        {items.length > 0 ? (
          <Button type="button" size="sm" onClick={() => setOpen(true)}>
            Review
          </Button>
        ) : null}
        {showBackfill ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={pending}
            onClick={() => sync(true)}
          >
            Fetch everything
          </Button>
        ) : null}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="gap-2"
          disabled={pending}
          onClick={() => sync(false)}
        >
          <ArrowsClockwise size={14} />
          {pending ? "Syncing…" : "Sync"}
        </Button>
      </div>
    </div>
  );

  return (
    <>
      {bar}

      <MobileSheet open={open} onOpenChange={setOpen} title="From your bank">
        <div className="flex flex-col gap-3">
          <p className="text-sm text-muted-foreground">
            Anything the app already recognised went straight in. These are the
            exceptions — answering one teaches it for next time.
          </p>

          <ul className="flex max-h-[60vh] flex-col gap-3 overflow-y-auto">
            {items.map((item) => (
              <li
                key={item.id}
                className="flex flex-col gap-2 rounded-lg border border-border p-3"
              >
                <div className="flex items-baseline justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {item.counterparty ?? item.note}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatShortDate(item.occurredOn)} · {item.why}
                    </p>
                  </div>
                  <span className="shrink-0 tabular-nums text-sm font-semibold">
                    {item.direction === "in" ? "+" : "\u2212"}
                    {formatMoney(item.amount)}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <CategorySelect
                    id={`feed-category-${item.id}`}
                    categories={categories}
                    value={choices[item.id] ?? ""}
                    onChange={(event) =>
                      setChoices((current) => ({
                        ...current,
                        [item.id]: event.target.value,
                      }))
                    }
                    className="min-w-44 flex-1"
                  />
                  <Button
                    type="button"
                    size="sm"
                    disabled={pending}
                    onClick={() => accept(item.id)}
                  >
                    Add
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={pending}
                    onClick={() => leaveOut(item.id)}
                  >
                    Leave out
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </MobileSheet>
    </>
  );
}

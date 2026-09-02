"use client";

import { useState, useTransition } from "react";
import { ArrowsClockwise } from "@phosphor-icons/react";
import { Button } from "@/components/retroui/Button";
import { Card } from "@/components/retroui/Card";
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
export function BankInbox({ items, categories }: BankInboxProps) {
  const { toast } = useToast();
  const formatMoney = useFormatCurrency();
  const [pending, startTransition] = useTransition();
  const [choices, setChoices] = useState<Record<string, string>>({});

  function sync() {
    startTransition(async () => {
      const result = await syncBankFeedAction();
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

  return (
    <Card className="block w-full">
      <Card.Header>
        <div className="flex items-center justify-between gap-3">
          <Card.Title>From your bank</Card.Title>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-2"
            disabled={pending}
            onClick={sync}
          >
            <ArrowsClockwise size={14} />
            {pending ? "Syncing…" : "Sync"}
          </Button>
        </div>
        <Card.Description>
          {items.length === 0
            ? "Nothing waiting. Anything the app already recognised went straight in."
            : `${items.length} ${items.length === 1 ? "entry needs" : "entries need"} a category. Answering one teaches the app for next time.`}
        </Card.Description>
      </Card.Header>

      {items.length > 0 && (
        <Card.Content>
          <ul className="flex flex-col gap-3">
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
                    {item.direction === "in" ? "+" : "−"}
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
        </Card.Content>
      )}
    </Card>
  );
}

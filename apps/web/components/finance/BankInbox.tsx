"use client";

import { useState, useTransition } from "react";
import { ArrowCounterClockwise, ArrowsClockwise } from "@phosphor-icons/react";
import { Button } from "@/components/retroui/Button";
import { MobileSheet } from "@/components/layout/MobileSheet";
import { CategorySelect } from "@/components/finance/CategorySelect";
import { useToast } from "@/components/layout/ToastProvider";
import { cn } from "@/lib/utils";
import { useFormatCurrency } from "@/lib/use-currency";
import { formatShortDate } from "@finance/core/constants";
import {
  ignoreFeedItem,
  importFeedItem,
  recategoriseFeedItem,
  syncBankFeedAction,
  undoFeedDecision,
} from "@/lib/actions/bank";
import type { Category } from "@finance/core/types/database";
import type { DecidedFeedRow, PendingFeedRow } from "@/lib/queries/bank";

interface BankInboxProps {
  items: PendingFeedRow[];
  /** What was decided recently, so a decision can be taken back. */
  decided: DecidedFeedRow[];
  categories: Category[];
  /** True until the whole statement has been pulled once. */
  showBackfill: boolean;
}

/**
 * Money in reads green and money out reads red, on the bank's own direction.
 *
 * Not the category's colour, which is what the ledger uses: at this point in
 * the flow there is no category yet — deciding it is the whole job — and the
 * one thing the bank has already told us is which way the money went.
 */
function Amount({
  direction,
  amount,
  className,
}: {
  direction: "in" | "out";
  amount: number;
  className?: string;
}) {
  const formatMoney = useFormatCurrency();

  return (
    <span
      className={cn(
        "shrink-0 tabular-nums",
        direction === "in" ? "text-success" : "text-destructive",
        className,
      )}
    >
      {direction === "in" ? "+" : "−"}
      {formatMoney(amount)}
    </span>
  );
}

/**
 * What the bank reported that the app would not file on its own.
 *
 * Everything the user's own history already answered for is in the ledger by
 * the time they see this, so the inbox is the exceptions — a first visit
 * somewhere, money arriving, a cash withdrawal. Answering one teaches the
 * matcher, which is why the list gets shorter every month rather than being a
 * permanent chore.
 *
 * Beside it, what was decided recently. Filing a card payment under the wrong
 * category is the easiest mistake to make here, and until now it was a
 * one-way door: the row vanished from the only screen that knew which bank
 * line it came from, and the fix meant hunting the transaction down in the
 * ledger, where that connection is no longer visible.
 */
export function BankInbox({
  items,
  decided,
  categories,
  showBackfill,
}: BankInboxProps) {
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();
  const [choices, setChoices] = useState<Record<string, string>>({});
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);

  function run(work: () => Promise<{ error?: string; message?: string }>) {
    startTransition(async () => {
      const result = await work();
      toast(
        result.error ?? result.message ?? "Done",
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
    run(() => importFeedItem(id, categoryId));
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
        {items.length > 0 || decided.length > 0 ? (
          <Button
            type="button"
            size="sm"
            variant={items.length > 0 ? "default" : "ghost"}
            onClick={() => setOpen(true)}
          >
            {items.length > 0 ? "Review" : "Recently added"}
          </Button>
        ) : null}
        {showBackfill ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={pending}
            onClick={() => run(() => syncBankFeedAction(true))}
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
          onClick={() => run(() => syncBankFeedAction(false))}
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

      <MobileSheet
        open={open}
        onOpenChange={setOpen}
        title="From your bank"
        wide={decided.length > 0}
      >
        <div className="flex flex-col gap-6 md:flex-row md:gap-8">
          <section className="flex min-w-0 flex-1 flex-col gap-3">
            <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {items.length > 0 ? "Needs a category" : "Nothing waiting"}
            </h3>
            <p className="text-sm text-muted-foreground">
              Anything the app already recognised went straight in. These are
              the exceptions — answering one teaches it for next time.
            </p>

            <ul className="flex flex-col gap-3 md:max-h-[55vh] md:overflow-y-auto">
              {items.map((item) => (
                <li
                  key={item.id}
                  className="flex flex-col gap-2 rounded-lg border border-border p-3"
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <div className="min-w-0">
                      {/* Wraps rather than truncates: the whole decision on
                          this row is what the line says, and a bank writes
                          "PRELEVEMENT Navigo Annuel - COMUTITRES SAS", which
                          clipped to "PRELEVEMENT Navi…" tells you nothing. */}
                      <p className="text-sm font-medium">
                        {item.counterparty ?? item.note}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatShortDate(item.occurredOn)} · {item.why}
                      </p>
                    </div>
                    <Amount
                      direction={item.direction}
                      amount={item.amount}
                      className="text-sm font-semibold"
                    />
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
                      onClick={() => run(() => ignoreFeedItem(item.id))}
                    >
                      Leave out
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          {decided.length > 0 ? (
            <section className="flex min-w-0 flex-col gap-3 border-t border-border pt-6 md:w-80 md:shrink-0 md:border-l md:border-t-0 md:pl-8 md:pt-0">
              <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Recently decided
              </h3>
              <p className="text-sm text-muted-foreground">
                Put one back if it went to the wrong place.
              </p>

              <ul className="flex flex-col divide-y divide-border md:max-h-[55vh] md:overflow-y-auto">
                {decided.map((row) => (
                  <li key={row.id} className="flex flex-col gap-1.5 py-2.5">
                    <div className="flex items-baseline justify-between gap-3">
                      <p className="min-w-0 flex-1 text-sm">
                        {row.counterparty ?? row.note}
                      </p>
                      <Amount
                        direction={row.direction}
                        amount={row.amount}
                        className="text-sm"
                      />
                    </div>

                    <p className="text-xs text-muted-foreground">
                      {formatShortDate(row.occurredOn)}
                      {" · "}
                      {row.status === "ignored"
                        ? "left out"
                        : (row.categoryName ?? "in your ledger")}
                    </p>

                    {editing === row.id ? (
                      <div className="flex flex-wrap items-center gap-2">
                        <CategorySelect
                          id={`decided-category-${row.id}`}
                          categories={categories}
                          value={choices[row.id] ?? row.categoryId ?? ""}
                          onChange={(event) =>
                            setChoices((current) => ({
                              ...current,
                              [row.id]: event.target.value,
                            }))
                          }
                          className="min-w-40 flex-1"
                        />
                        <Button
                          type="button"
                          size="sm"
                          disabled={pending}
                          onClick={() => {
                            const categoryId = choices[row.id];
                            if (!categoryId) {
                              toast("Pick a category first", "error");
                              return;
                            }
                            setEditing(null);
                            run(() => recategoriseFeedItem(row.id, categoryId));
                          }}
                        >
                          Move
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditing(null)}
                        >
                          Cancel
                        </Button>
                      </div>
                    ) : (
                      <div className="flex flex-wrap items-center gap-1">
                        {row.status === "imported" ? (
                          <Button
                            type="button"
                            variant="link"
                            size="sm"
                            className="h-7 px-0"
                            disabled={pending}
                            onClick={() => setEditing(row.id)}
                          >
                            Change category
                          </Button>
                        ) : null}
                        <Button
                          type="button"
                          variant="link"
                          size="sm"
                          className="h-7 gap-1 px-2 text-muted-foreground"
                          disabled={pending}
                          onClick={() => run(() => undoFeedDecision(row.id))}
                        >
                          <ArrowCounterClockwise size={13} />
                          Undo
                        </Button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      </MobileSheet>
    </>
  );
}

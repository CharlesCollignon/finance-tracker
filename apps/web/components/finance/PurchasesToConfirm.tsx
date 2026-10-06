"use client";

import { useState, useTransition } from "react";
import { Check, X } from "@phosphor-icons/react";
import { amountSign } from "@finance/core/amount-sign";
import { TYPE_AMOUNT_CLASS } from "@finance/core/category-styles";
import { formatShortDate } from "@finance/core/constants";
import type { PurchaseToConfirm } from "@finance/core/purchases-to-confirm";
import {
  recordPurchaseInsideWallet,
  skipPlannedOccurrence,
} from "@/lib/actions/finance";
import { useToast } from "@/components/layout/ToastProvider";
import { PrivateAmount } from "@/components/layout/PrivateAmount";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import { useFormatCurrency } from "@/lib/use-currency";
import { ICON } from "@/lib/icon-scale";
import { useLocale, useT } from "@/lib/locale-context";

/**
 * "Did this purchase go through?" — for a DCA PEA, a DCA CTO, with a bank
 * feeding the ledger.
 *
 * The bank is the record there, and nothing is written from a charge. A
 * purchase inside a wallet is the one it cannot cover: the money moves inside
 * the broker, where the bank never looks. So from its day it is asked about
 * here — a yes records it on its day, which is what grows the position it
 * feeds, and a no skips it. Left unanswered, nothing is recorded.
 *
 * Answered rows leave at once, as on « C'est arrivé ? »: the decision is
 * recorded either way, a failure is toasted and puts the row back.
 */
export function PurchasesToConfirm({
  purchases,
}: {
  purchases: PurchaseToConfirm[];
}) {
  const t = useT();
  const { toast } = useToast();
  const formatMoney = useFormatCurrency();
  const locale = useLocale();
  const [pending, startTransition] = useTransition();
  const [answered, setAnswered] = useState<Set<string>>(new Set());
  // Held only while the server still offers the purchase, so one put back
  // somewhere else — a skip undone — is asked about again.
  const [seen, setSeen] = useState(purchases);
  if (purchases !== seen) {
    setSeen(purchases);
    const offered = new Set(purchases.map((purchase) => purchase.key));
    setAnswered(
      (current) => new Set([...current].filter((key) => offered.has(key))),
    );
  }

  const waiting = purchases.filter((purchase) => !answered.has(purchase.key));
  if (waiting.length === 0) {
    return null;
  }

  function answer(
    purchase: PurchaseToConfirm,
    work: () => Promise<{ error?: string; message?: string }>,
    done: string,
  ) {
    setAnswered((current) => new Set(current).add(purchase.key));
    startTransition(async () => {
      const result = await work();
      if (result.error) {
        setAnswered((current) => {
          const next = new Set(current);
          next.delete(purchase.key);
          return next;
        });
        toast(result.error, "error");
        return;
      }
      toast(result.message ?? done, "success");
    });
  }

  return (
    <section
      aria-label={t("fulfilment.purchaseTitle", { count: waiting.length })}
      className="flex flex-col"
    >
      <div className="border-b border-foreground/10 px-4 py-2">
        <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {t("fulfilment.purchaseTitle", { count: waiting.length })}
        </h3>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {t("fulfilment.purchaseWhy")}
        </p>
      </div>

      <ul className="flex flex-col">
        {waiting.map((purchase) => {
          const date = formatShortDate(purchase.occurredOn, locale);
          return (
            <li
              key={purchase.key}
              className="flex flex-col gap-2 border-b border-foreground/10 px-4 py-3 last:border-0 sm:flex-row sm:items-center sm:gap-3"
            >
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-baseline gap-x-2 text-sm">
                  <span className="font-medium">{purchase.label}</span>
                  <PrivateAmount
                    className={cn("tabular-nums", TYPE_AMOUNT_CLASS.investment)}
                  >
                    {`${amountSign("investment")}${formatMoney(purchase.amount)}`}
                  </PrivateAmount>
                </p>
                <p className="text-xs text-muted-foreground">
                  {t("fulfilment.purchaseDue", { date })}
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <Button
                  type="button"
                  disabled={pending}
                  onClick={() =>
                    answer(
                      purchase,
                      () =>
                        recordPurchaseInsideWallet(
                          purchase.templateId,
                          purchase.occurredOn,
                        ),
                      t("fulfilment.done"),
                    )
                  }
                  size="sm"
                  className="gap-1.5 rounded-full"
                >
                  <Check size={ICON.sm} weight="bold" />
                  {t("fulfilment.purchaseYes")}
                </Button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() =>
                    answer(
                      purchase,
                      () =>
                        skipPlannedOccurrence(
                          purchase.templateId,
                          purchase.occurredOn,
                        ),
                      t("planned.skipped", { date }),
                    )
                  }
                  className={cn(
                    "inline-flex min-h-9 items-center gap-1.5 rounded-full px-3 text-sm",
                    "text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
                    "disabled:opacity-60",
                  )}
                >
                  <X size={ICON.sm} />
                  {t("fulfilment.purchaseNo")}
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

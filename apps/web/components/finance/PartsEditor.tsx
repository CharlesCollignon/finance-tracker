"use client";

import { useState, useTransition } from "react";
import { Plus, X } from "@phosphor-icons/react";
import { parseTypedAmount } from "@finance/core/amount-input";
import { resolveMessage } from "@finance/core/i18n/t";
import type { Category, Transaction } from "@finance/core/types/database";
import { SPLIT_PARTS_MAX } from "@finance/core/validations/splits";
import { CategoryPicker } from "@/components/finance/CategoryPicker";
import { useToast } from "@/components/layout/ToastProvider";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { PrivateAmount } from "@/components/layout/PrivateAmount";
import {
  splitTransactionAction,
  unsplitTransactionAction,
} from "@/lib/actions/splits";
import { ICON } from "@/lib/icon-scale";
import { useT } from "@/lib/locale-context";
import { useFormatCurrency } from "@/lib/use-currency";
import { cn } from "@/lib/utils";

interface Part {
  amount: string;
  categoryId: string;
}

/** To the cent. */
function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * One payment in several parts (migration 079): the row's amount placed
 * into two or more parts, each with its category, the remainder shown as
 * the parts are typed. A row already part of a split offers to put the
 * parts back together instead. The phone draws the same editor.
 */
export function PartsEditor({
  transaction,
  categories,
  onDone,
}: {
  transaction: Transaction;
  categories: Category[];
  /** The sheet closes: the row on screen is not this row any more. */
  onDone: () => void;
}) {
  const t = useT();
  const format = useFormatCurrency();
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const total = Number(transaction.amount);
  const [parts, setParts] = useState<Part[]>(() => [
    { amount: "", categoryId: transaction.category_id },
    { amount: "", categoryId: transaction.category_id },
  ]);

  const placed = parts.reduce(
    (sum, part) => sum + (parseTypedAmount(part.amount) ?? 0),
    0,
  );
  const remainder = roundMoney(total - placed);
  const complete =
    Math.abs(remainder) < 0.005 &&
    parts.every(
      (part) => (parseTypedAmount(part.amount) ?? 0) > 0 && part.categoryId,
    );

  function setPart(index: number, change: Partial<Part>) {
    setParts((current) =>
      current.map((part, at) => (at === index ? { ...part, ...change } : part)),
    );
  }

  function save() {
    startTransition(async () => {
      const result = await splitTransactionAction({
        id: transaction.id,
        parts: parts.map((part) => ({
          amount: parseTypedAmount(part.amount) ?? 0,
          categoryId: part.categoryId,
        })),
      });
      if (result.error) {
        toast(resolveMessage(t, result.error), "error");
        return;
      }
      toast(t("transaction.splitDone"), "success");
      onDone();
    });
  }

  function unsplit() {
    startTransition(async () => {
      const result = await unsplitTransactionAction(transaction.id);
      if (result.error) {
        toast(resolveMessage(t, result.error), "error");
        return;
      }
      toast(t("transaction.unsplitDone"), "success");
      onDone();
    });
  }

  if (transaction.split_group) {
    return (
      <div className="flex flex-col gap-2">
        <p className="text-sm text-muted-foreground">{t("transaction.splitMark")}</p>
        <Button
          type="button"
          variant="outline"
          className="w-full"
          disabled={pending}
          onClick={unsplit}
        >
          {t("transaction.unsplit")}
        </Button>
      </div>
    );
  }

  if (!open) {
    return (
      <Button
        type="button"
        variant="outline"
        className="w-full"
        onClick={() => setOpen(true)}
      >
        {t("transaction.split")}
      </Button>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-control border border-border p-3">
      <p className="text-sm font-medium">{t("transaction.splitTitle")}</p>
      <p className="text-xs text-muted-foreground">{t("transaction.splitHint")}</p>
      <ul className="flex flex-col gap-2">
        {parts.map((part, index) => (
          <li key={index} className="flex items-center gap-2">
            <Input
              type="text"
              inputMode="decimal"
              aria-label={t("transaction.splitPart", { index: index + 1 })}
              placeholder="0,00"
              value={part.amount}
              onChange={(event) => setPart(index, { amount: event.target.value })}
              className="w-28 text-base"
            />
            <CategoryPicker
              id={`part-${index}-category`}
              categories={categories}
              value={part.categoryId}
              onValueChange={(categoryId) => setPart(index, { categoryId })}
              className="min-w-0 flex-1"
            />
            {parts.length > 2 ? (
              <button
                type="button"
                aria-label={t("transaction.splitRemovePart")}
                onClick={() =>
                  setParts((current) => current.filter((_, at) => at !== index))
                }
                className="flex size-9 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X size={ICON.sm} />
              </button>
            ) : null}
          </li>
        ))}
      </ul>
      <div className="flex items-center justify-between gap-3">
        <PrivateAmount
          className={cn(
            "text-xs",
            remainder < -0.005 ? "text-destructive" : "text-muted-foreground",
          )}
        >
          {remainder < -0.005
            ? t("transaction.splitOver", { amount: format(-remainder) })
            : t("transaction.splitRemainder", { amount: format(remainder) })}
        </PrivateAmount>
        {parts.length < SPLIT_PARTS_MAX ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() =>
              setParts((current) => [
                ...current,
                {
                  amount: remainder > 0 ? String(remainder) : "",
                  categoryId: transaction.category_id,
                },
              ])
            }
          >
            <Plus size={ICON.sm} />
            {t("transaction.splitAddPart")}
          </Button>
        ) : null}
      </div>
      <div className="flex gap-2">
        <Button
          type="button"
          className="flex-1"
          disabled={pending || !complete}
          onClick={save}
        >
          {pending ? t("transaction.splitSaving") : t("transaction.splitSave")}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => setOpen(false)}
          disabled={pending}
        >
          {t("transaction.cancel")}
        </Button>
      </div>
    </div>
  );
}

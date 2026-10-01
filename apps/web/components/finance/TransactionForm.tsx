"use client";

import {
  useActionState,
  useEffect,
  useEffectEvent,
  useState,
  useTransition,
} from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { FormLabel } from "@/components/ui/FormLabel";
import { Text } from "@/components/ui/Text";
import { useToast } from "@/components/layout/ToastProvider";
import { MobileSheet } from "@/components/ui/MobileSheet";
import { CategoryPicker } from "@/components/finance/CategoryPicker";
import {
  deleteTransaction,
  saveQuickTransaction,
  updateTransaction,
} from "@/lib/actions/finance";
import { formatShortDate, todayIsoLocal } from "@finance/core/constants";
import { bringsMoneyIn, isMovedRow } from "@finance/core/cash-date";
import { monthLong } from "@finance/core/i18n/calendar-names";
import { moveBackEarlyIncome } from "@/lib/actions/fulfilment";
import type { Category, Transaction } from "@finance/core/types/database";
import { useLocale, useT } from "@/lib/locale-context";
import { resolveMessage } from "@finance/core/i18n/t";
import type { FormState } from "@finance/core/action-result";

interface TransactionFormProps {
  categories: Category[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The transaction being edited. */
  transaction: Transaction | null;
  onDeleted?: () => void;
}

/**
 * Editing one transaction.
 *
 * Adding one happens in the shared Add sheet, the same one behind every "+"
 * in the app; this form used to do both, which is how the Ledger's Add and
 * the notch's came to ask for the same thing in two different ways.
 */
export function TransactionForm({
  categories,
  open,
  onOpenChange,
  transaction,
  onDeleted,
}: TransactionFormProps) {
  if (!open || !transaction) {
    return null;
  }

  return (
    <TransactionFormFields
      key={transaction.id}
      categories={categories}
      open={open}
      onOpenChange={onOpenChange}
      transaction={transaction}
      onDeleted={onDeleted}
    />
  );
}

interface TransactionFormFieldsProps {
  categories: Category[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction: Transaction;
  onDeleted?: () => void;
}

function TransactionFormFields({
  categories,
  open,
  onOpenChange,
  transaction,
  onDeleted,
}: TransactionFormFieldsProps) {
  const { toast } = useToast();
  const t = useT();
  const locale = useLocale();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deletePending, startDelete] = useTransition();
  const [duplicatePending, startDuplicate] = useTransition();
  const [state, action, pending] = useActionState<FormState, FormData>(
    updateTransaction,
    {},
  );
  // A charge's row. Deleting it takes that occurrence out of its month —
  // which is what skipping used to be a separate button for — so the month
  // filling itself does not write it straight back.
  const fromCharge = Boolean(transaction.recurring_template_id);

  // Once per result. Keyed on the callbacks too, as it was, a parent passing
  // `onOpenChange` inline replayed the last result on every render: the same
  // error toasted again each time the page behind the sheet re-rendered.
  const reportResult = useEffectEvent((result: typeof state) => {
    if (result.success) {
      toast(t("transaction.saved"), "success");
      onOpenChange(false);
    } else if (result.error) {
      toast(result.error, "error");
    }
  });

  useEffect(() => {
    reportResult(state);
  }, [state]);

  /**
   * Repeating an entry is the most common thing anyone does with a ledger —
   * the same shop, a week later. Mobile has had this since the start; the
   * desktop client was the slower one for the same task.
   */
  function handleDuplicate() {
    startDuplicate(async () => {
      const result = await saveQuickTransaction({
        categoryId: transaction.category_id,
        amount: Number(transaction.amount),
        // Today, not the original date: a copy is a new occurrence.
        occurredOn: todayIsoLocal(),
        note: transaction.note ?? undefined,
      });

      if (result.error) {
        toast(result.error, "error");
        return;
      }

      toast(t("transaction.duplicated"), "success");
      onOpenChange(false);
    });
  }

  // An income counted for this month whose money arrived in the last one
  // (`cash_on`): the sheet says so, and offers to put it back on its day.
  const arrivedOn = isMovedRow(transaction) ? transaction.cash_on! : null;
  const [moveBackPending, startMoveBack] = useTransition();

  function handleMoveBack() {
    startMoveBack(async () => {
      const result = await moveBackEarlyIncome(transaction.id);
      if (result.error) {
        toast(result.error, "error");
        return;
      }
      toast(result.message ?? t("transaction.saved"), "success");
      onOpenChange(false);
    });
  }

  function handleDelete() {
    startDelete(async () => {
      const result = await deleteTransaction(transaction.id);
      if (result.error) {
        toast(result.error, "error");
        return;
      }
      toast(t("transaction.deleted"), "success");
      onOpenChange(false);
      onDeleted?.();
    });
  }

  return (
    <MobileSheet
      open={open}
      onOpenChange={onOpenChange}
      title={t("transaction.editTitle")}
    >
      <form action={action} className="flex flex-col gap-4">
        <input type="hidden" name="id" value={transaction.id} />
        <div className="flex flex-col gap-2">
          <FormLabel htmlFor="categoryId">
            {t("transaction.category")}
          </FormLabel>
          <CategoryPicker
            id="categoryId"
            categories={categories}
            label={t("transaction.category")}
            required
            defaultValue={transaction.category_id}
          />
        </div>
        <div className="flex flex-col gap-2">
          <FormLabel htmlFor="amount">{t("transaction.amount")}</FormLabel>
          <Input
            id="amount"
            name="amount"
            type="number"
            step="0.01"
            min="0.01"
            required
            className="text-base"
            placeholder="0.00"
            defaultValue={String(Number(transaction.amount))}
          />
        </div>
        <div className="flex flex-col gap-2">
          <FormLabel htmlFor="occurredOn">{t("transaction.date")}</FormLabel>
          <Input
            id="occurredOn"
            name="occurredOn"
            type="date"
            required
            defaultValue={transaction.occurred_on}
            className="text-base"
          />
          {arrivedOn ? (
            <div className="flex flex-col items-start gap-2 rounded-control border border-border px-3 py-2.5">
              <p className="text-xs text-muted-foreground">
                {t(
                  bringsMoneyIn(
                    categories.find(
                      (c) => c.id === transaction.category_id,
                    ) ?? {
                      type: "expense",
                    },
                  )
                    ? "transaction.countsForReceived"
                    : "transaction.countsForPaid",
                  {
                    month: monthLong(
                      Number(transaction.occurred_on.slice(5, 7)),
                      locale,
                    ),
                    date: formatShortDate(arrivedOn, locale),
                  },
                )}
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={moveBackPending}
                onClick={handleMoveBack}
              >
                {t("transaction.moveBack", {
                  date: formatShortDate(arrivedOn, locale),
                })}
              </Button>
            </div>
          ) : null}
        </div>
        <div className="flex flex-col gap-2">
          <FormLabel htmlFor="note">{t("transaction.note")}</FormLabel>
          <Input
            id="note"
            name="note"
            type="text"
            className="text-base"
            placeholder={t("transaction.notePlaceholder")}
            defaultValue={transaction.note ?? undefined}
          />
        </div>
        {state.error && (
          <Text className="text-sm text-destructive">
            {resolveMessage(t, state.error)}
          </Text>
        )}
        <Button
          type="submit"
          size="lg"
          className="w-full"
          disabled={pending || deletePending}
        >
          {pending ? t("transaction.saving") : t("transaction.saveTransaction")}
        </Button>
      </form>

      <div className="mt-6 space-y-3 border-t border-border pt-4">
        <Button
          type="button"
          variant="outline"
          className="w-full"
          disabled={duplicatePending}
          onClick={handleDuplicate}
        >
          {duplicatePending
            ? t("transaction.duplicating")
            : t("transaction.duplicateToToday")}
        </Button>

        {confirmDelete ? (
          <div className="flex flex-col gap-2">
            <p className="text-sm text-muted-foreground">
              {fromCharge
                ? t("transaction.deleteChargeExplanation")
                : t("transaction.deleteExplanation")}
            </p>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1 border-destructive text-destructive"
                disabled={deletePending}
                onClick={handleDelete}
              >
                {deletePending
                  ? t("transaction.deleting")
                  : t("transaction.confirmDelete")}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                disabled={deletePending}
                onClick={() => setConfirmDelete(false)}
              >
                {t("transaction.cancel")}
              </Button>
            </div>
          </div>
        ) : (
          <Button
            type="button"
            variant="outline"
            className="w-full border-destructive text-destructive"
            onClick={() => setConfirmDelete(true)}
          >
            {t("transaction.deleteTransaction")}
          </Button>
        )}
      </div>
    </MobileSheet>
  );
}

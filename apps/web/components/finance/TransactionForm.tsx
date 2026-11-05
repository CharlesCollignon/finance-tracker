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
import {
  SHEET_FIELD,
  SheetDanger,
  SheetField,
  SheetFigure,
  SheetGlow,
  SheetSave,
  typedAmount,
} from "@/components/finance/sheet/entry-sheet";
import { KIND_INK } from "@/components/finance/add/parts";
import { parseTypedAmount } from "@finance/core/amount-input";
import { amountSign } from "@finance/core/amount-sign";
import { useFormatCurrency } from "@/lib/use-currency";
import { Text } from "@/components/ui/Text";
import { useToast } from "@/components/layout/ToastProvider";
import { useDeletedToast } from "@/lib/use-deleted-toast";
import { MobileSheet } from "@/components/ui/MobileSheet";
import { CategoryPicker } from "@/components/finance/CategoryPicker";
import { PartsEditor } from "@/components/finance/PartsEditor";
import { ReceiptSection } from "@/components/finance/ReceiptSection";
import {
  deleteTransaction,
  saveQuickTransaction,
  updateTransaction,
} from "@/lib/actions/finance";
import {
  formatShortDate,
  relativeDayLabel,
  todayIsoLocal,
} from "@finance/core/constants";
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
  /**
   * Called inside the delete's transition, before the server answers, so a
   * list can take the row away at once.
   */
  onDeleting?: (id: string) => void;
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
  onDeleting,
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
      onDeleting={onDeleting}
      onDeleted={onDeleted}
    />
  );
}

interface TransactionFormFieldsProps {
  categories: Category[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction: Transaction;
  onDeleting?: (id: string) => void;
  onDeleted?: () => void;
}

function TransactionFormFields({
  categories,
  open,
  onOpenChange,
  transaction,
  onDeleting,
  onDeleted,
}: TransactionFormFieldsProps) {
  const { toast } = useToast();
  const toastDeleted = useDeletedToast();
  const t = useT();
  const locale = useLocale();
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
      onDeleting?.(transaction.id);
      const result = await deleteTransaction(transaction.id);
      if (!result.success) {
        toast(result.error, "error");
        return;
      }
      toastDeleted(t("transaction.deleted"), result.undo);
      onOpenChange(false);
      onDeleted?.();
    });
  }

  const formatEuro = useFormatCurrency();
  const startAmount = typedAmount(Number(transaction.amount), locale);
  const [amount, setAmount] = useState(startAmount);
  const [categoryId, setCategoryId] = useState(transaction.category_id);
  const [occurredOn, setOccurredOn] = useState(transaction.occurred_on);
  const [note, setNote] = useState(transaction.note ?? "");
  const category = categories.find((c) => c.id === categoryId) ?? null;
  const kind = category?.type ?? "expense";
  const ink = KIND_INK[kind];
  const parsed = parseTypedAmount(amount);
  const changed =
    categoryId !== transaction.category_id ||
    parsed !== Number(transaction.amount) ||
    occurredOn !== transaction.occurred_on ||
    note !== (transaction.note ?? "");
  const caption = [
    category?.name,
    note.trim(),
    occurredOn ? relativeDayLabel(occurredOn, formatShortDate, locale) : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <MobileSheet
      open={open}
      onOpenChange={onOpenChange}
      title={t("transaction.editTitle")}
    >
      <div className="relative">
        <div className="relative -mx-4 -mt-4 h-0 md:-mx-5 md:-mt-5">
          <SheetGlow ink={ink} />
        </div>
        <form action={action} className="relative flex flex-col gap-4">
          <input type="hidden" name="id" value={transaction.id} />
          <SheetFigure
            id="amount"
            name="amount"
            value={amount}
            onChange={setAmount}
            ink={ink}
            sign={amountSign(kind)}
            label={t("transaction.amount")}
            caption={caption}
          />
          <SheetField label={t("transaction.category")} htmlFor="categoryId">
            <CategoryPicker
              id="categoryId"
              categories={categories}
              label={t("transaction.category")}
              required
              value={categoryId}
              onValueChange={setCategoryId}
            />
          </SheetField>
          <SheetField label={t("transaction.date")} htmlFor="occurredOn">
            <Input
              id="occurredOn"
              name="occurredOn"
              type="date"
              required
              value={occurredOn}
              onChange={(event) => setOccurredOn(event.target.value)}
              className={SHEET_FIELD}
            />
            {arrivedOn ? (
              <div className="mt-1 flex flex-col items-start gap-2 rounded-2xl border border-border px-3 py-2.5">
                <p className="text-xs text-muted-foreground">
                  {t(
                    bringsMoneyIn(category ?? { type: "expense" })
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
          </SheetField>
          <SheetField label={t("transaction.note")} htmlFor="note">
            <Input
              id="note"
              name="note"
              type="text"
              className={SHEET_FIELD}
              placeholder={t("transaction.notePlaceholder")}
              value={note}
              onChange={(event) => setNote(event.target.value)}
            />
          </SheetField>
          {state.error && (
            <Text className="text-sm text-destructive">
              {resolveMessage(t, state.error)}
            </Text>
          )}
          <SheetSave
            label={
              pending
                ? t("transaction.saving")
                : changed
                  ? t("quickAdd.save")
                  : t("entry.noChange")
            }
            figure={
              changed && !pending && parsed
                ? `${amountSign(kind)}${formatEuro(parsed)}`
                : undefined
            }
            disabled={pending || deletePending || !changed || !parsed}
          />
        </form>
      </div>

      <div className="mt-6 flex flex-col gap-3 border-t border-border pt-4">
        {/* The picture behind the row, and one payment in several parts
            (migration 079): each closes the sheet once the row has changed
            under it. */}
        <ReceiptSection
          transaction={transaction}
          onApplied={() => onOpenChange(false)}
        />
        <PartsEditor
          transaction={transaction}
          categories={categories}
          onDone={() => onOpenChange(false)}
        />

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

        <SheetDanger
          label={t("transaction.deleteTransaction")}
          explanation={
            fromCharge
              ? t("transaction.deleteChargeExplanation")
              : t("transaction.deleteExplanation")
          }
          confirmLabel={
            deletePending
              ? t("transaction.deleting")
              : t("transaction.confirmDelete")
          }
          cancelLabel={t("transaction.cancel")}
          pending={deletePending}
          onConfirm={handleDelete}
        />
      </div>
    </MobileSheet>
  );
}

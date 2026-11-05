import { useState } from "react";
import { View } from "react-native";

import { parseTypedAmount } from "@finance/core/amount-input";
import { amountSign } from "@finance/core/amount-sign";
import type {
  Category,
  TransactionWithCategory,
} from "@finance/core/types/database";

import { KIND_INK } from "@/components/add/kind-ink";
import { CategoryPicker } from "@/components/pickers/CategoryPicker";
import { PartsEditor } from "@/components/PartsEditor";
import { ReceiptRow } from "@/components/ReceiptRow";
import {
  DangerAction,
  EntrySheet,
  Field,
  FigureInput,
  SaveButton,
} from "@/components/sheet/EntrySheet";
import { Button } from "@/components/ui/Button";
import { DateField } from "@/components/ui/DateField";
import { Input } from "@/components/ui/Input";
import { Text } from "@/components/ui/Text";
import { toTypedAmount } from "@/lib/typed-amount";
import {
  deleteTransaction,
  moveBackEarlyIncome,
  updateTransaction,
} from "@/lib/mutations";
import { useDeletedToast } from "@/hooks/useDeletedToast";
import { hapticSuccess, hapticWarning } from "@/lib/haptics";
import { useFormatCurrency } from "@/providers/CurrencyProvider";
import { useLocale, useT } from "@/providers/LocaleProvider";
import { useToast } from "@/providers/ToastProvider";
import { useThemeColors } from "@/theme/useThemeColors";
import { resolveMessage } from "@finance/core/i18n/t";
import { bringsMoneyIn, isMovedRow } from "@finance/core/cash-date";
import { formatShortDate, relativeDayLabel } from "@finance/core/constants";
import { monthLong } from "@finance/core/i18n/calendar-names";

interface TransactionFormModalProps {
  open: boolean;
  onClose: () => void;
  categories: Category[];
  /** The transaction being edited. */
  transaction: TransactionWithCategory;
  /** Most-recently-used category ids, newest first. */
  recentCategoryIds?: string[];
}

/**
 * Editing one transaction, in the Add sheet's language (November 2026): the
 * amount as the figure at the top, in its kind's colour and editable where
 * it stands, the category, day and note under it, and the save button
 * saying what it will save — or that nothing has changed yet. The receipt,
 * the parts and removing it sit below, out of the way.
 *
 * Adding one happens in the shared Add sheet behind the "+".
 */
export function TransactionFormModal({
  open,
  onClose,
  categories,
  transaction,
  recentCategoryIds = [],
}: TransactionFormModalProps) {
  const locale = useLocale();
  const t = useT();
  const colors = useThemeColors();
  const formatEuro = useFormatCurrency();
  const { toast } = useToast();
  const toastDeleted = useDeletedToast();
  const startAmount = toTypedAmount(Number(transaction.amount), locale);
  const [categoryId, setCategoryId] = useState(transaction.category_id);
  // In the reader's own shape — "12,5" in French — so the field reads back
  // exactly what it was given.
  const [amount, setAmount] = useState(startAmount);
  const [occurredOn, setOccurredOn] = useState(transaction.occurred_on);
  const [note, setNote] = useState(transaction.note ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  // A charge's row. Deleting it takes that occurrence out of its month —
  // which is what skipping used to be a separate button for — so the month
  // filling itself does not write it straight back.
  const fromCharge = Boolean(transaction.recurring_template_id);

  const category =
    categories.find((candidate) => candidate.id === categoryId) ?? null;
  const kind = category?.type ?? transaction.categories?.type ?? "expense";
  const ink = colors[KIND_INK[kind]];
  const parsed = parseTypedAmount(amount);
  const changed =
    categoryId !== transaction.category_id ||
    parsed !== Number(transaction.amount) ||
    occurredOn !== transaction.occurred_on ||
    note !== (transaction.note ?? "");

  async function handleSave() {
    setPending(true);
    setError(null);
    const result = await updateTransaction({
      id: transaction.id,
      categoryId,
      // Whichever shape it was typed in, « 1 234,56 » included. Unreadable
      // is sent as nothing, which the schema answers with its own message.
      amount: parsed ?? 0,
      occurredOn,
      note: note || undefined,
    });
    setPending(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    void hapticSuccess();
    toast(t("transaction.saved"), "success");
    onClose();
  }

  // An income counted for this month whose money arrived in the last one
  // (`cash_on`): it says so, and offers to put it back on the day it came.
  const arrivedOn = isMovedRow(transaction) ? transaction.cash_on! : null;

  async function handleMoveBack() {
    setPending(true);
    setError(null);
    const result = await moveBackEarlyIncome(transaction.id, locale);
    setPending(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    onClose();
  }

  async function handleDelete() {
    setPending(true);
    setError(null);
    const result = await deleteTransaction(transaction.id);
    setPending(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    void hapticWarning();
    toastDeleted(t("transaction.deleted"), result.undo);
    onClose();
  }

  const caption = [
    category?.name,
    note.trim(),
    relativeDayLabel(occurredOn, formatShortDate, locale),
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <EntrySheet
      visible={open}
      onClose={onClose}
      title={t("transaction.editTitle")}
      closeLabel={t("transaction.close")}
      ink={ink}
      footer={
        <SaveButton
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
          disabled={pending || !changed || !parsed}
          onPress={() => void handleSave()}
        />
      }
    >
      <FigureInput
        value={amount}
        onChange={setAmount}
        ink={ink}
        sign={amountSign(kind)}
        label={t("transaction.amount")}
        caption={caption}
      />

      <View className="mt-5 gap-4">
        {/* The web's picker, a sheet over this one; the recent ones head it. */}
        <Field label={t("transaction.category")}>
          <CategoryPicker
            label={t("transaction.category")}
            categories={categories}
            value={categoryId}
            onChange={setCategoryId}
            recentIds={recentCategoryIds}
          />
        </Field>

        <Field label={t("transaction.date")}>
          <DateField value={occurredOn} onChange={setOccurredOn} />
          {arrivedOn ? (
            <View className="mt-1 gap-2 rounded-2xl border border-border px-3 py-2.5">
              <Text variant="muted" className="text-xs">
                {t(
                  bringsMoneyIn(transaction.categories)
                    ? "transaction.countsForReceived"
                    : "transaction.countsForPaid",
                  {
                    month: monthLong(Number(occurredOn.slice(5, 7)), locale),
                    date: formatShortDate(arrivedOn, locale),
                  },
                )}
              </Text>
              <Button
                label={t("transaction.moveBack", {
                  date: formatShortDate(arrivedOn, locale),
                })}
                variant="outline"
                size="sm"
                className="self-start"
                disabled={pending}
                onPress={() => void handleMoveBack()}
              />
            </View>
          ) : null}
        </Field>

        <Field label={t("transaction.note")}>
          <Input
            value={note}
            onChangeText={setNote}
            placeholder={t("transaction.notePlaceholder")}
            tone="sheet"
          />
        </Field>

        {error ? (
          <Text className="text-sm text-destructive">
            {resolveMessage(t, error)}
          </Text>
        ) : null}
      </View>

      <View className="mt-6 gap-3 border-t border-border pt-4">
        {/* The picture behind the row, and one payment in several parts
            (migration 079): each closes the sheet once the row has changed
            under it. */}
        <ReceiptRow transaction={transaction} onApplied={onClose} />
        <PartsEditor
          transaction={transaction}
          categories={categories}
          onDone={onClose}
        />
        <DangerAction
          label={t("transaction.deleteTransaction")}
          explanation={
            fromCharge
              ? t("transaction.deleteChargeExplanation")
              : t("transaction.deleteExplanation")
          }
          confirmLabel={
            pending ? t("transaction.deleting") : t("transaction.confirmDelete")
          }
          cancelLabel={t("transaction.cancel")}
          pending={pending}
          onConfirm={() => void handleDelete()}
        />
      </View>
    </EntrySheet>
  );
}

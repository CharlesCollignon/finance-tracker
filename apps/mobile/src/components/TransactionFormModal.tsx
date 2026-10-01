import { useState } from "react";
import { Modal, Pressable, ScrollView, View } from "react-native";

import { parseTypedAmount } from "@finance/core/amount-input";
import { INTL_LOCALES } from "@finance/core/i18n/locale";
import type {
  Category,
  TransactionWithCategory,
} from "@finance/core/types/database";

import { CategoryPicker } from "@/components/pickers/CategoryPicker";
import { Button } from "@/components/ui/Button";
import { DateField } from "@/components/ui/DateField";
import { Input } from "@/components/ui/Input";
import { Text } from "@/components/ui/Text";
import { SheetGrabber } from "@/components/ui/SheetGrabber";
import { toTypedAmount } from "@/lib/typed-amount";
import {
  deleteTransaction,
  moveBackEarlyIncome,
  updateTransaction,
} from "@/lib/mutations";
import { useLocale, useT } from "@/providers/LocaleProvider";
import { resolveMessage } from "@finance/core/i18n/t";
import { bringsMoneyIn, isMovedRow } from "@finance/core/cash-date";
import { formatShortDate } from "@finance/core/constants";
import { monthLong } from "@finance/core/i18n/calendar-names";

interface TransactionFormModalProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  onDeleted?: () => void;
  categories: Category[];
  /** The transaction being edited. */
  transaction: TransactionWithCategory;
  /** Most-recently-used category ids, newest first. */
  recentCategoryIds?: string[];
}

/**
 * Editing one transaction, mirroring the web TransactionForm: category,
 * amount, date and note, then the delete action behind an inline
 * confirmation rather than a system alert.
 *
 * Adding one happens in the shared Add sheet behind the "+"; this sheet used
 * to do both, which is how the Ledger's Add and the "+" came to ask for the
 * same thing in two different ways.
 */
export function TransactionFormModal({
  open,
  onClose,
  onSaved,
  onDeleted,
  categories,
  transaction,
  recentCategoryIds = [],
}: TransactionFormModalProps) {
  const locale = useLocale();
  const t = useT();
  const [categoryId, setCategoryId] = useState(transaction.category_id);
  // In the reader's own shape — "12,5" in French — so the field reads back
  // exactly what it was given.
  const [amount, setAmount] = useState(() =>
    toTypedAmount(Number(transaction.amount), locale),
  );
  const [occurredOn, setOccurredOn] = useState(transaction.occurred_on);
  const [note, setNote] = useState(transaction.note ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  // "0,00" in French: the placeholder shows the separator to type.
  const amountPlaceholder = new Intl.NumberFormat(INTL_LOCALES[locale], {
    minimumFractionDigits: 2,
  }).format(0);
  // A charge's row. Deleting it takes that occurrence out of its month —
  // which is what skipping used to be a separate button for — so the month
  // filling itself does not write it straight back.
  const fromCharge = Boolean(transaction.recurring_template_id);

  async function handleSave() {
    setPending(true);
    setError(null);
    const result = await updateTransaction({
      id: transaction.id,
      categoryId,
      // Whichever shape it was typed in, « 1 234,56 » included. Unreadable
      // is sent as nothing, which the schema answers with its own message.
      amount: parseTypedAmount(amount) ?? 0,
      occurredOn,
      note: note || undefined,
    });
    setPending(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    onSaved();
    onClose();
  }

  // An income counted for this month whose money arrived in the last one
  // (`cash_on`): it says so, and offers to put it back on the day it came.
  const arrivedOn = isMovedRow(transaction) ? transaction.cash_on! : null;

  async function handleMoveBack() {
    setPending(true);
    setError(null);
    const result = await moveBackEarlyIncome(transaction.id);
    setPending(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    onSaved();
    onClose();
  }

  async function handleDelete() {
    setPending(true);
    setError(null);
    const result = await deleteTransaction(transaction.id);
    setPending(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    (onDeleted ?? onSaved)();
    onClose();
  }

  return (
    <Modal
      visible={open}
      animationType="slide"
      transparent
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View className="flex-1 justify-end bg-black/50">
        <Pressable
          className="flex-1"
          accessibilityLabel={t("transaction.close")}
          onPress={onClose}
        />
        <View className="max-h-[90%] rounded-t-card border border-border bg-card">
          <View className="items-center pt-3">
            <SheetGrabber />
          </View>
          <View className="flex-row items-center justify-between px-5 pb-2 pt-3">
            <Text className="font-semibold" style={{ fontSize: 18 }}>
              {t("transaction.editTitle")}
            </Text>
            <Pressable
              onPress={onClose}
              accessibilityLabel={t("transaction.close")}
              hitSlop={8}
            >
              <Text variant="muted">{t("transaction.close")}</Text>
            </Pressable>
          </View>

          <ScrollView
            className="px-5"
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* The web's picker, a sheet over this one. It used to be the
                whole category list drawn above the amount, with a search box
                and a row of recent ones on top of that; the recent ones now
                head the picker instead. */}
            <Text className="mb-2 text-sm font-medium">
              {t("transaction.category")}
            </Text>
            <CategoryPicker
              label={t("transaction.category")}
              categories={categories}
              value={categoryId}
              onChange={setCategoryId}
              recentIds={recentCategoryIds}
              className="mb-4"
            />

            <Text className="mb-2 text-sm font-medium">
              {t("transaction.amount")}
            </Text>
            <Input
              value={amount}
              onChangeText={setAmount}
              keyboardType="decimal-pad"
              placeholder={amountPlaceholder}
              className="mb-4"
            />

            <Text className="mb-2 text-sm font-medium">
              {t("transaction.date")}
            </Text>
            <DateField
              value={occurredOn}
              onChange={setOccurredOn}
              className={arrivedOn ? "mb-2" : "mb-4"}
            />
            {arrivedOn ? (
              <View className="mb-4 gap-2 rounded-control border border-border px-3 py-2.5">
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

            <Text className="mb-2 text-sm font-medium">
              {t("transaction.note")}
            </Text>
            <Input
              value={note}
              onChangeText={setNote}
              placeholder={t("transaction.notePlaceholder")}
              className="mb-4"
            />

            {error ? (
              <Text className="mb-3 text-sm text-destructive">
                {resolveMessage(t, error)}
              </Text>
            ) : null}

            <Button
              label={
                pending
                  ? t("transaction.saving")
                  : t("transaction.saveTransaction")
              }
              size="lg"
              disabled={pending}
              onPress={handleSave}
            />

            <View className="mt-6 gap-3 border-t border-border pt-4">
              {confirmDelete ? (
                <View className="gap-2">
                  <Text variant="muted" className="text-sm">
                    {fromCharge
                      ? t("transaction.deleteChargeExplanation")
                      : t("transaction.deleteExplanation")}
                  </Text>
                  <View className="flex-row gap-2">
                    <Button
                      label={
                        pending
                          ? t("transaction.deleting")
                          : t("transaction.confirmDelete")
                      }
                      variant="outline"
                      className="flex-1 border-destructive"
                      disabled={pending}
                      onPress={handleDelete}
                    />
                    <Button
                      label={t("transaction.cancel")}
                      variant="outline"
                      className="flex-1"
                      disabled={pending}
                      onPress={() => setConfirmDelete(false)}
                    />
                  </View>
                </View>
              ) : (
                <Button
                  label={t("transaction.deleteTransaction")}
                  variant="outline"
                  className="border-destructive"
                  disabled={pending}
                  onPress={() => setConfirmDelete(true)}
                />
              )}
            </View>

            <View className="h-10" />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

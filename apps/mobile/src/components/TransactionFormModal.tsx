import { useEffect, useState } from "react";
import { Modal, Pressable, ScrollView, View } from "react-native";

import { INTL_LOCALES } from "@finance/core/i18n/locale";
import type {
  Category,
  Tag,
  TransactionWithCategory,
} from "@finance/core/types/database";

import { CategoryPicker } from "@/components/pickers/CategoryPicker";
import { MultiChips } from "@/components/pickers/MultiChips";
import { Button } from "@/components/ui/Button";
import { DateField } from "@/components/ui/DateField";
import { Input } from "@/components/ui/Input";
import { Text } from "@/components/ui/Text";
import { SheetGrabber } from "@/components/ui/SheetGrabber";
import {
  deleteTransaction,
  setTransactionTags,
  updateTransaction,
} from "@/lib/mutations";
import { getTransactionTagIds } from "@/lib/queries";
import { useLocale, useT } from "@/providers/LocaleProvider";
import { resolveMessage } from "@finance/core/i18n/t";

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
  tags?: Tag[];
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
  tags = [],
}: TransactionFormModalProps) {
  const locale = useLocale();
  const t = useT();
  const [categoryId, setCategoryId] = useState(transaction.category_id);
  const [amount, setAmount] = useState(String(Number(transaction.amount)));
  const [occurredOn, setOccurredOn] = useState(transaction.occurred_on);
  const [note, setNote] = useState(transaction.note ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [tagIds, setTagIds] = useState<string[]>([]);
  // Whether the edited transaction's existing tags finished loading. Saving
  // before this resolves — or after it fails — must not overwrite the row's
  // tags with an empty list, so the write below checks this rather than
  // assuming an empty `tagIds` means "no tags".
  const [tagsLoaded, setTagsLoaded] = useState(false);

  // Existing tags load once per edited transaction.
  useEffect(() => {
    let active = true;
    void getTransactionTagIds(transaction.id)
      .then((ids) => {
        if (active) {
          setTagIds(ids);
          setTagsLoaded(true);
        }
      })
      .catch(() => {
        // Leave tagsLoaded false: a failed load must block the tag write on
        // save rather than silently clearing the transaction's tags.
      });
    return () => {
      active = false;
    };
  }, [transaction]);

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
      // A French keypad types a comma; the schema reads a point.
      amount: amount.replace(",", ".").trim(),
      occurredOn,
      note: note || undefined,
    });
    setPending(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    // Tags are a separate table, so they are written after the row. Only
    // once the existing tags have loaded — writing before or after a failed
    // load would clear the transaction's tags.
    if (tags.length > 0 && tagsLoaded) {
      await setTransactionTags(transaction.id, tagIds);
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
              className="mb-4"
            />

            <Text className="mb-2 text-sm font-medium">
              {t("transaction.note")}
            </Text>
            <Input
              value={note}
              onChangeText={setNote}
              placeholder={t("transaction.notePlaceholder")}
              className="mb-4"
            />

            {tags.length > 0 ? (
              <>
                <Text className="mb-2 text-sm font-medium">
                  {t("transaction.tags")}
                </Text>
                <MultiChips
                  label={t("transaction.tags")}
                  className="mb-4"
                  options={tags.map((tag) => ({
                    value: tag.id,
                    label: tag.name,
                  }))}
                  values={tagIds}
                  onChange={setTagIds}
                />
              </>
            ) : null}

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

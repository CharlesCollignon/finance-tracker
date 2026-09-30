import { useEffect, useState } from "react";
import { Modal, Pressable, ScrollView, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import {
  formatCategoryOptionLabel,
  groupCategoriesByType,
} from "@finance/core/categories";
import type {
  Category,
  Tag,
  TransactionWithCategory,
} from "@finance/core/types/database";

import { CategoryIcon } from "@/components/CategoryIcon";
import { Button } from "@/components/ui/Button";
import { DateField } from "@/components/ui/DateField";
import { Input } from "@/components/ui/Input";
import { Text } from "@/components/ui/Text";
import { SheetGrabber } from "@/components/ui/SheetGrabber";
import { cn } from "@/lib/cn";
import { hapticLight } from "@/lib/haptics";
import { useThemeColors } from "@/theme/useThemeColors";
import {
  deleteTransaction,
  setTransactionTags,
  updateTransaction,
} from "@/lib/mutations";
import { getTransactionTagIds } from "@/lib/queries";
import { ICON } from "@/theme/tokens";
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
  const colors = useThemeColors();
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

  const [categoryQuery, setCategoryQuery] = useState("");

  // Filter before grouping so empty groups disappear while searching.
  const visibleCategories = categoryQuery.trim()
    ? categories.filter((cat) =>
        cat.name.toLowerCase().includes(categoryQuery.trim().toLowerCase()),
      )
    : categories;
  const groups = groupCategoriesByType(visibleCategories);

  // One tap instead of scrolling the full grouped list, which is the common
  // case: people log the same handful of categories over and over.
  const recentCategories = recentCategoryIds
    .map((id) => categories.find((cat) => cat.id === id))
    .filter((cat): cat is Category => cat !== undefined)
    .slice(0, 4);
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
      amount,
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
            <Text className="mb-2 text-sm font-medium">
              {t("transaction.category")}
            </Text>
            {categories.length > 8 ? (
              <View className="mb-3 flex-row items-center gap-2 rounded-full border border-border bg-background px-3">
                <Ionicons
                  name="search-outline"
                  size={ICON.md}
                  color={colors.mutedForeground}
                />
                <TextInput
                  value={categoryQuery}
                  onChangeText={setCategoryQuery}
                  placeholder={t("transaction.filterCategoriesPlaceholder")}
                  placeholderTextColor={colors.mutedForeground}
                  accessibilityLabel={t("transaction.filterCategories")}
                  className="h-10 flex-1 font-sans text-sm text-foreground"
                />
              </View>
            ) : null}
            {recentCategories.length > 0 && !categoryQuery.trim() ? (
              <View className="mb-3">
                <Text variant="muted" className="mb-2 text-xs">
                  Recent
                </Text>
                <View className="flex-row flex-wrap gap-2">
                  {recentCategories.map((cat) => {
                    const selected = categoryId === cat.id;
                    return (
                      <Pressable
                        key={cat.id}
                        accessibilityRole="button"
                        accessibilityState={{ selected }}
                        onPress={() => {
                          void hapticLight();
                          setCategoryId(cat.id);
                        }}
                        className={cn(
                          "flex-row items-center gap-2 rounded-full border px-3 py-2",
                          selected
                            ? "border-primary bg-primary/15"
                            : "border-border bg-background",
                        )}
                      >
                        <CategoryIcon icon={cat.icon} className="h-6 w-6" />
                        <Text className="text-sm">{cat.name}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ) : null}

            <View className="mb-4 gap-3">
              {groups.map((group) => (
                <View key={group.type} className="gap-1.5">
                  <Text variant="muted" className="text-xs">
                    {group.label}
                  </Text>
                  {group.categories.map((cat) => {
                    const selected = categoryId === cat.id;
                    return (
                      <Pressable
                        key={cat.id}
                        accessibilityRole="button"
                        accessibilityState={{ selected }}
                        accessibilityLabel={cat.name}
                        onPress={() => setCategoryId(cat.id)}
                        className={cn(
                          "flex-row items-center gap-3 rounded-control border px-3 py-2",
                          selected
                            ? "border-primary bg-primary/15"
                            : "border-border bg-background",
                        )}
                      >
                        <CategoryIcon icon={cat.icon} />
                        <Text className="flex-1 text-sm">
                          {formatCategoryOptionLabel(cat, locale)}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              ))}
            </View>

            <Text className="mb-2 text-sm font-medium">
              {t("transaction.amount")}
            </Text>
            <Input
              value={amount}
              onChangeText={setAmount}
              keyboardType="decimal-pad"
              placeholder="0.00"
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
                <View className="mb-4 flex-row flex-wrap gap-2">
                  {tags.map((tag) => {
                    const selected = tagIds.includes(tag.id);
                    return (
                      <Pressable
                        key={tag.id}
                        accessibilityRole="checkbox"
                        accessibilityState={{ checked: selected }}
                        accessibilityLabel={tag.name}
                        onPress={() =>
                          setTagIds((current) =>
                            current.includes(tag.id)
                              ? current.filter((id) => id !== tag.id)
                              : [...current, tag.id],
                          )
                        }
                        className={cn(
                          "rounded-full border px-3 py-2",
                          selected
                            ? "border-primary bg-primary/15"
                            : "border-border bg-background",
                        )}
                      >
                        <Text
                          className={cn(
                            "text-sm",
                            selected && "text-primary-ink",
                          )}
                        >
                          {tag.name}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
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

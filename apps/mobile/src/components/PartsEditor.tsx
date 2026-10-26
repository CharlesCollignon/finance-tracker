import { useState } from "react";
import { Pressable, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { parseTypedAmount } from "@finance/core/amount-input";
import { resolveMessage } from "@finance/core/i18n/t";
import type { Category, Transaction } from "@finance/core/types/database";
import { SPLIT_PARTS_MAX } from "@finance/core/validations/splits";

import { CategoryPicker } from "@/components/pickers/CategoryPicker";
import { PrivateAmount } from "@/components/PrivateAmount";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Text } from "@/components/ui/Text";
import { cn } from "@/lib/cn";
import { hapticLight, hapticSuccess } from "@/lib/haptics";
import { splitTransaction, unsplitTransaction } from "@/lib/mutations";
import { toTypedAmount } from "@/lib/typed-amount";
import { useFormatCurrency } from "@/providers/CurrencyProvider";
import { useLocale, useT } from "@/providers/LocaleProvider";
import { useToast } from "@/providers/ToastProvider";
import { ICON } from "@/theme/tokens";
import { useThemeColors } from "@/theme/useThemeColors";

interface Part {
  amount: string;
  categoryId: string;
}

/** To the cent. */
function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * One payment in several parts (migration 079) — the web's editor: the
 * row's amount placed into two or more parts, each with its category, the
 * remainder shown as the parts are typed. A row already part of a split
 * offers to put the parts back together instead.
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
  const locale = useLocale();
  const format = useFormatCurrency();
  const colors = useThemeColors();
  const { toast } = useToast();
  const [pending, setPending] = useState(false);
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

  async function save() {
    setPending(true);
    const result = await splitTransaction({
      id: transaction.id,
      parts: parts.map((part) => ({
        amount: parseTypedAmount(part.amount) ?? 0,
        categoryId: part.categoryId,
      })),
    });
    setPending(false);
    if (result.error) {
      toast(resolveMessage(t, result.error), "error");
      return;
    }
    void hapticSuccess();
    toast(t("transaction.splitDone"), "success");
    onDone();
  }

  async function unsplit() {
    setPending(true);
    const result = await unsplitTransaction(transaction.id);
    setPending(false);
    if (result.error) {
      toast(resolveMessage(t, result.error), "error");
      return;
    }
    void hapticSuccess();
    toast(t("transaction.unsplitDone"), "success");
    onDone();
  }

  if (transaction.split_group) {
    return (
      <View className="gap-2">
        <Text variant="muted" className="text-sm">
          {t("transaction.splitMark")}
        </Text>
        <Button
          label={t("transaction.unsplit")}
          variant="outline"
          disabled={pending}
          onPress={() => void unsplit()}
        />
      </View>
    );
  }

  if (!open) {
    return (
      <Button
        label={t("transaction.split")}
        variant="outline"
        onPress={() => {
          void hapticLight();
          setOpen(true);
        }}
      />
    );
  }

  return (
    <View className="gap-3 rounded-control border border-border p-3">
      <Text className="text-sm font-medium">{t("transaction.splitTitle")}</Text>
      <Text variant="muted" className="text-xs">
        {t("transaction.splitHint")}
      </Text>
      {parts.map((part, index) => (
        <View key={index} className="flex-row items-center gap-2">
          <Input
            value={part.amount}
            onChangeText={(amount) => setPart(index, { amount })}
            keyboardType="decimal-pad"
            placeholder={toTypedAmount(0, locale)}
            accessibilityLabel={t("transaction.splitPart", { index: index + 1 })}
            className="w-28"
          />
          <CategoryPicker
            label={t("transaction.splitPart", { index: index + 1 })}
            categories={categories}
            value={part.categoryId}
            onChange={(categoryId) => setPart(index, { categoryId })}
            className="min-w-0 flex-1"
          />
          {parts.length > 2 ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("transaction.splitRemovePart")}
              hitSlop={8}
              onPress={() =>
                setParts((current) => current.filter((_, at) => at !== index))
              }
              className="h-9 w-9 items-center justify-center rounded-full"
            >
              <Ionicons name="close" size={ICON.sm} color={colors.mutedForeground} />
            </Pressable>
          ) : null}
        </View>
      ))}
      <View className="flex-row items-center justify-between gap-3">
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
            label={t("transaction.splitAddPart")}
            variant="ghost"
            size="sm"
            icon="add"
            onPress={() =>
              setParts((current) => [
                ...current,
                {
                  amount: remainder > 0 ? toTypedAmount(remainder, locale) : "",
                  categoryId: transaction.category_id,
                },
              ])
            }
          />
        ) : null}
      </View>
      <View className="flex-row gap-2">
        <Button
          label={pending ? t("transaction.splitSaving") : t("transaction.splitSave")}
          className="flex-1"
          disabled={pending || !complete}
          onPress={() => void save()}
        />
        <Button
          label={t("transaction.cancel")}
          variant="outline"
          disabled={pending}
          onPress={() => setOpen(false)}
        />
      </View>
    </View>
  );
}

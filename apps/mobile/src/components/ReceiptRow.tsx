import { useState } from "react";
import { Linking, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { formatShortDate } from "@finance/core/constants";
import { resolveMessage } from "@finance/core/i18n/t";
import type { ReceiptReading } from "@finance/core/receipts";
import type { TransactionWithCategory } from "@finance/core/types/database";

import { PrivateAmount } from "@/components/PrivateAmount";
import { Button } from "@/components/ui/Button";
import { Text } from "@/components/ui/Text";
import { hapticSuccess } from "@/lib/haptics";
import { updateTransaction } from "@/lib/mutations";
import {
  attachReceipt,
  pickReceipt,
  readReceipt,
  receiptUrl,
  removeReceipt,
} from "@/lib/receipts";
import { useAuth } from "@/providers/AuthProvider";
import { useFormatCurrency } from "@/providers/CurrencyProvider";
import { useLocale, useT } from "@/providers/LocaleProvider";
import { useToast } from "@/providers/ToastProvider";
import { ICON } from "@/theme/tokens";
import { useThemeColors } from "@/theme/useThemeColors";

/**
 * « Justificatif » (migration 079) — the web's section: the picture or the
 * PDF behind a row, attached, opened, removed, and read on the person's own
 * AI account when they ask, the three things read then applied or not.
 */
export function ReceiptRow({
  transaction,
  onApplied,
}: {
  transaction: TransactionWithCategory;
  /** The row changed from the reading: the sheet closes. */
  onApplied: () => void;
}) {
  const t = useT();
  const locale = useLocale();
  const format = useFormatCurrency();
  const colors = useThemeColors();
  const { toast } = useToast();
  const { user } = useAuth();
  const [pending, setPending] = useState(false);
  const [path, setPath] = useState<string | null>(
    transaction.receipt_path ?? null,
  );
  const [reading, setReading] = useState<ReceiptReading | null>(null);

  function say(result: { error?: string; message?: string }) {
    const text = result.error ?? result.message;
    if (text) {
      toast(resolveMessage(t, text), result.error ? "error" : "success");
    }
  }

  async function attach() {
    if (!user) {
      return;
    }
    const picked = await pickReceipt();
    if ("canceled" in picked) {
      return;
    }
    if ("error" in picked) {
      toast(resolveMessage(t, picked.error), "error");
      return;
    }
    setPending(true);
    const result = await attachReceipt(
      user.id,
      transaction.id,
      path,
      picked.bytes,
    );
    setPending(false);
    say(result);
    if (result.success) {
      void hapticSuccess();
      setPath(transaction.receipt_path ?? "attached");
    }
  }

  async function open() {
    if (!path) {
      return;
    }
    setPending(true);
    const url = await receiptUrl(path);
    setPending(false);
    if (!url) {
      toast(t("transaction.receiptReadFailed"), "error");
      return;
    }
    await Linking.openURL(url);
  }

  async function remove() {
    if (!path) {
      return;
    }
    setPending(true);
    const result = await removeReceipt(transaction.id, path);
    setPending(false);
    say(result);
    if (result.success) {
      setPath(null);
      setReading(null);
    }
  }

  async function read() {
    if (!path) {
      return;
    }
    setPending(true);
    const result = await readReceipt(path);
    setPending(false);
    if ("error" in result) {
      toast(resolveMessage(t, result.error), "error");
      return;
    }
    setReading(result.reading);
  }

  async function apply(current: ReceiptReading) {
    setPending(true);
    const result = await updateTransaction({
      id: transaction.id,
      categoryId: transaction.category_id,
      amount: current.total ?? Number(transaction.amount),
      occurredOn: current.date ?? transaction.occurred_on,
      note: current.merchant ?? transaction.note ?? undefined,
    });
    setPending(false);
    if (result.error) {
      toast(resolveMessage(t, result.error), "error");
      return;
    }
    void hapticSuccess();
    toast(t("transaction.receiptApplied"), "success");
    onApplied();
  }

  // The path as stored is what the links need; a file just attached is
  // known by the fresh row the next load brings, so until then only the
  // actions that need no path are offered.
  const stored = path && path !== "attached" ? path : null;

  return (
    <View className="gap-2">
      <View className="flex-row items-center gap-1.5">
        <Ionicons name="attach-outline" size={ICON.sm} color={colors.foreground} />
        <Text className="text-sm font-medium">{t("transaction.receipt")}</Text>
      </View>
      <View className="flex-row flex-wrap gap-2">
        {stored ? (
          <>
            <Button
              label={t("transaction.receiptView")}
              variant="outline"
              size="sm"
              disabled={pending}
              onPress={() => void open()}
            />
            <Button
              label={pending ? t("transaction.receiptReading") : t("transaction.receiptRead")}
              variant="outline"
              size="sm"
              disabled={pending}
              onPress={() => void read()}
            />
            <Button
              label={t("transaction.receiptAttach")}
              variant="ghost"
              size="sm"
              disabled={pending}
              onPress={() => void attach()}
            />
            <Button
              label={t("transaction.receiptRemove")}
              variant="ghost"
              size="sm"
              disabled={pending}
              onPress={() => void remove()}
            />
          </>
        ) : (
          <Button
            label={
              pending ? t("transaction.receiptAttaching") : t("transaction.receiptAttach")
            }
            variant="outline"
            size="sm"
            disabled={pending}
            onPress={() => void attach()}
          />
        )}
      </View>
      <Text variant="muted" className="text-xs">
        {stored ? t("transaction.receiptReadHint") : t("transaction.receiptKind")}
      </Text>
      {reading ? (
        <View className="gap-2 rounded-control border border-border p-3">
          <PrivateAmount className="text-sm">
            {t("transaction.receiptReadResult", {
              merchant: reading.merchant ?? "—",
              date: reading.date ? formatShortDate(reading.date, locale) : "—",
              amount: reading.total !== null ? format(reading.total) : "—",
            })}
          </PrivateAmount>
          <Button
            label={t("transaction.receiptApply")}
            size="sm"
            className="self-start"
            disabled={pending}
            onPress={() => void apply(reading)}
          />
        </View>
      ) : null}
    </View>
  );
}

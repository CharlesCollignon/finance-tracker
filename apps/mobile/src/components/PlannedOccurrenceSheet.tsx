import { useState } from "react";
import { Modal, Pressable, View } from "react-native";
import { useRouter } from "expo-router";

import type { PlannedOccurrence } from "@finance/core/apply-recurring";
import { formatShortDate, todayIsoLocal } from "@finance/core/constants";
import { TYPE_AMOUNT_CLASS } from "@finance/core/category-styles";
import { resolveMessage } from "@finance/core/i18n/t";

import { CategoryIcon } from "@/components/CategoryIcon";
import { PrivateAmount } from "@/components/PrivateAmount";
import { Button } from "@/components/ui/Button";
import { Text } from "@/components/ui/Text";
import { cn } from "@/lib/cn";
import { hapticSuccess } from "@/lib/haptics";
import { recordPlannedNow, skipPlannedOccurrence } from "@/lib/mutations";
import { useFormatCurrency } from "@/providers/CurrencyProvider";
import { useLocale, useT } from "@/providers/LocaleProvider";
import { useToast } from "@/providers/ToastProvider";

interface PlannedOccurrenceSheetProps {
  /** The planned row that was tapped, or null while the sheet is shut. */
  occurrence: PlannedOccurrence | null;
  onClose: () => void;
  /** After a record or a skip, so the screens can read the month again. */
  onChanged: () => void;
}

/**
 * One occurrence still to come, opened.
 *
 * A planned row is not a transaction, so it cannot open the transaction
 * editor: there is nothing stored to edit. What can be decided about it is
 * the three things the web twin offers — it already happened, it will not
 * happen this time, or the charge itself is wrong — and each is one press.
 *
 * "Record it now" only for an occurrence in the month in progress. Next
 * month's rent arriving today is not a thing that happens, and offering it
 * would make the button a way to write a row dated weeks before its charge.
 */
export function PlannedOccurrenceSheet({
  occurrence,
  onClose,
  onChanged,
}: PlannedOccurrenceSheetProps) {
  const t = useT();
  const locale = useLocale();
  const router = useRouter();
  const { toast } = useToast();
  const formatEuro = useFormatCurrency();
  const [pending, setPending] = useState(false);

  if (!occurrence) {
    return null;
  }

  const current = occurrence;
  const date = formatShortDate(current.occurredOn, locale);
  const inThisMonth =
    current.occurredOn.slice(0, 7) === todayIsoLocal().slice(0, 7);

  async function record() {
    setPending(true);
    const result = await recordPlannedNow(
      current.templateId,
      current.occurredOn,
    );
    setPending(false);
    if (result.error) {
      toast(resolveMessage(t, result.error), "error");
      return;
    }
    void hapticSuccess();
    // No undo on the phone: the recorded row is in the list, and deleting
    // it is the way back, the same as for any row.
    toast(t("planned.recorded"), "success");
    onClose();
    onChanged();
  }

  async function skip() {
    setPending(true);
    const result = await skipPlannedOccurrence(
      current.templateId,
      current.occurredOn,
    );
    setPending(false);
    if (result.error) {
      toast(resolveMessage(t, result.error), "error");
      return;
    }
    void hapticSuccess();
    // The Ledger's "Skipped this month" card is the way back, with Restore.
    toast(t("planned.skipped", { date }), "success");
    onClose();
    onChanged();
  }

  function editCharge() {
    onClose();
    // The Charges tab opens this charge's editor on arrival, the way the
    // Ledger opens its review for `?review=inbox`.
    router.push(`/(tabs)/recurring?edit=${current.templateId}` as never);
  }

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View className="flex-1 items-center justify-center bg-black/50 px-6">
        <Pressable
          accessibilityLabel={t("common.close")}
          className="absolute inset-0"
          onPress={onClose}
        />
        <View className="w-full max-w-sm rounded-card border border-border bg-card p-card">
          <View className="flex-row items-center gap-3">
            <View style={{ opacity: 0.6 }}>
              <CategoryIcon icon={current.categoryIcon} />
            </View>
            <View className="min-w-0 flex-1">
              <Text
                accessibilityRole="header"
                numberOfLines={2}
                className="font-semibold"
                style={{ fontSize: 17 }}
              >
                {current.name}
              </Text>
              <Text variant="muted" className="text-xs">
                {current.categoryName}
              </Text>
            </View>
            <PrivateAmount
              className={cn(
                "font-mono text-base font-semibold",
                TYPE_AMOUNT_CLASS[current.categoryType],
              )}
            >
              {formatEuro(current.amount)}
            </PrivateAmount>
          </View>

          <Text variant="muted" className="mt-3 text-sm">
            {t("planned.body", { date })}
          </Text>

          <View className="mt-5 gap-2">
            {inThisMonth ? (
              <View className="gap-1">
                <Button
                  label={t("planned.recordNow")}
                  disabled={pending}
                  onPress={() => void record()}
                />
                <Text variant="muted" className="text-center text-xs">
                  {t("planned.recordNowHint")}
                </Text>
              </View>
            ) : null}
            <Button
              label={t("planned.skip")}
              variant="outline"
              disabled={pending}
              onPress={() => void skip()}
            />
            <Button
              label={t("planned.editCharge")}
              variant="ghost"
              disabled={pending}
              onPress={editCharge}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

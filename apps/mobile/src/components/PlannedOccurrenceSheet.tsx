import { useState } from "react";
import { Modal, Pressable, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

import { amountSign } from "@finance/core/amount-sign";
import type { PlannedOccurrence } from "@finance/core/apply-recurring";
import { formatShortDate, todayIsoLocal } from "@finance/core/constants";
import { TYPE_AMOUNT_CLASS } from "@finance/core/category-styles";

import { CategoryIcon } from "@/components/CategoryIcon";
import { PrivateAmount } from "@/components/PrivateAmount";
import { Button } from "@/components/ui/Button";
import { SheetGrabber } from "@/components/ui/SheetGrabber";
import { Text } from "@/components/ui/Text";
import { cn } from "@/lib/cn";
import { hapticLight, hapticSuccess } from "@/lib/haptics";
import {
  recordPlannedNow,
  skipPlannedOccurrence,
  undoRecordPlanned,
  unskipRecurringOccurrence,
} from "@/lib/mutations";
import { useFormatCurrency } from "@/providers/CurrencyProvider";
import { useLocale, useT } from "@/providers/LocaleProvider";
import { useToast } from "@/providers/ToastProvider";
import { ICON } from "@/theme/tokens";
import { useThemeColors } from "@/theme/useThemeColors";

interface PlannedOccurrenceSheetProps {
  /** The planned row that was tapped, or null while the sheet is shut. */
  occurrence: PlannedOccurrence | null;
  onClose: () => void;
}

/** What was just done, kept so it can be taken back from the sheet. */
type Done = { kind: "recorded"; transactionId: string } | { kind: "skipped" };

/**
 * One occurrence still to come, opened — the web's sheet, from the bottom.
 *
 * A planned row is not a transaction, so it cannot open the transaction
 * editor: there is nothing stored to edit. What can be decided about it is
 * the three things the web offers — it already happened, it will not happen
 * this time, or the recurring entry itself is wrong — and each is one press.
 *
 * The web takes a record or a skip back from the toast that reports it. The
 * phone's toasts carry no button, so the sheet stays up and says what
 * happened, with Undo beside it: neither leaves anything to find afterwards
 * except a row that stopped being planned.
 *
 * "Record it now" only for an occurrence in the month in progress. Next
 * month's rent arriving today is not a thing that happens, and offering it
 * would make the button a way to write a row dated weeks before its charge.
 */
export function PlannedOccurrenceSheet({
  occurrence,
  onClose,
}: PlannedOccurrenceSheetProps) {
  const t = useT();
  const locale = useLocale();
  const router = useRouter();
  const colors = useThemeColors();
  const { toast } = useToast();
  const formatEuro = useFormatCurrency();
  const [pending, setPending] = useState(false);
  // Keyed by occurrence, so opening another one starts fresh by derivation
  // rather than through an effect that resets state.
  const [done, setDone] = useState<{ key: string; done: Done } | null>(null);

  if (!occurrence) {
    return null;
  }

  const current = occurrence;
  const date = formatShortDate(current.occurredOn, locale);
  const inThisMonth =
    current.occurredOn.slice(0, 7) === todayIsoLocal().slice(0, 7);
  const outcome = done?.key === current.key ? done.done : null;

  function close() {
    setDone(null);
    onClose();
  }

  async function record() {
    setPending(true);
    const result = await recordPlannedNow(
      current.templateId,
      current.occurredOn,
    );
    setPending(false);
    if (result.error || !result.transactionId) {
      toast(result.error ?? "actions.couldNotRecord", "error");
      return;
    }
    void hapticSuccess();
    setDone({
      key: current.key,
      done: { kind: "recorded", transactionId: result.transactionId },
    });
  }

  async function skip() {
    setPending(true);
    const result = await skipPlannedOccurrence(
      current.templateId,
      current.occurredOn,
    );
    setPending(false);
    if (result.error) {
      toast(result.error, "error");
      return;
    }
    void hapticSuccess();
    setDone({ key: current.key, done: { kind: "skipped" } });
  }

  async function undo() {
    if (!outcome) {
      return;
    }
    setPending(true);
    const result =
      outcome.kind === "recorded"
        ? await undoRecordPlanned(
            outcome.transactionId,
            current.templateId,
            current.occurredOn,
          )
        : await unskipRecurringOccurrence(
            current.templateId,
            current.occurredOn,
          );
    setPending(false);
    if (result.error) {
      toast(result.error, "error");
      return;
    }
    void hapticLight();
    toast(t("reviewScreens.plannedAgain"), "success");
    close();
  }

  function editCharge() {
    close();
    // The Recurring tab opens this entry's editor on arrival, the way the
    // Ledger opens its review for `?review=inbox`.
    router.push(`/(tabs)/recurring?edit=${current.templateId}` as never);
  }

  return (
    <Modal
      visible
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={close}
    >
      <View className="flex-1 justify-end bg-black/50">
        <Pressable
          accessibilityLabel={t("common.close")}
          className="flex-1"
          onPress={close}
        />
        <View className="rounded-t-card border border-border bg-card px-card pb-10 pt-3">
          <SheetGrabber />
          <Text
            accessibilityRole="header"
            numberOfLines={2}
            className="mb-4 font-semibold"
            style={{ fontSize: 18 }}
          >
            {current.name}
          </Text>

          <View className="flex-row items-center gap-3">
            {/* Dashed, as on the web: a thing expected, not a thing done. */}
            <View
              className="rounded-control border border-dashed"
              style={{ borderColor: colors.hairlineStrong, opacity: 0.8 }}
            >
              <CategoryIcon icon={current.categoryIcon} />
            </View>
            <View className="min-w-0 flex-1">
              <Text numberOfLines={1} className="text-sm font-medium">
                {current.categoryName}
              </Text>
              <Text variant="muted" className="text-sm">
                {t(
                  current.awaited ? "planned.awaitedBody" : "planned.body",
                  { date },
                )}
              </Text>
            </View>
            <PrivateAmount
              className={cn(
                "text-base font-semibold",
                TYPE_AMOUNT_CLASS[current.categoryType],
              )}
            >
              {`${amountSign(current.categoryType)}${formatEuro(current.amount)}`}
            </PrivateAmount>
          </View>

          {outcome ? (
            <View className="mt-6 gap-3">
              <View className="flex-row items-center gap-2 rounded-control border border-border px-3 py-3">
                <Ionicons
                  name="checkmark-circle"
                  size={ICON.md}
                  color={colors.success}
                />
                <Text className="min-w-0 flex-1 text-sm">
                  {outcome.kind === "recorded"
                    ? t("planned.recorded")
                    : t("planned.skipped", { date })}
                </Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ disabled: pending }}
                  disabled={pending}
                  hitSlop={8}
                  onPress={() => void undo()}
                  className="min-h-11 flex-row items-center gap-1 px-1"
                >
                  <Ionicons
                    name="arrow-undo-outline"
                    size={ICON.sm}
                    color={colors.foreground}
                  />
                  <Text className="text-sm font-medium">
                    {t("planned.undo")}
                  </Text>
                </Pressable>
              </View>
              <Button
                label={t("common.close")}
                variant="outline"
                size="lg"
                disabled={pending}
                onPress={close}
              />
            </View>
          ) : (
            <View className="mt-6 gap-2">
              {/* One the bank still owes is recorded by the bank. */}
              {inThisMonth && !current.awaited ? (
                <View className="gap-1">
                  <Button
                    label={t("planned.recordNow")}
                    size="lg"
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
                size="lg"
                disabled={pending}
                onPress={() => void skip()}
              />
              <Button
                label={t("planned.editCharge")}
                variant="ghost"
                size="lg"
                disabled={pending}
                onPress={editCharge}
              />
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

import { useEffect, useState } from "react";
import { Pressable, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

import { amountSign } from "@finance/core/amount-sign";
import {
  describeMiss,
  type FulfilmentMiss,
} from "@finance/core/recurring-fulfilment";
import type { PlannedOccurrence } from "@finance/core/apply-recurring";
import { formatShortDate, todayIsoLocal } from "@finance/core/constants";

import { KIND_INK, withAlpha } from "@/components/add/kind-ink";
import { CategoryGlyph } from "@/components/CategoryIcon";
import {
  EntrySheet,
  FigureValue,
  SaveButton,
} from "@/components/sheet/EntrySheet";
import { Button } from "@/components/ui/Button";
import { Text } from "@/components/ui/Text";
import { hapticLight, hapticSuccess } from "@/lib/haptics";
import {
  explainAwaitedOccurrence,
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
  // Why the bank has not brought it, asked when the sheet opens on one it
  // still owes; kept with the occurrence it answers, as `done` is.
  const [why, setWhy] = useState<{
    key: string;
    miss: FulfilmentMiss | null;
  } | null>(null);
  const awaitedKey = occurrence?.awaited ? occurrence.key : null;

  useEffect(() => {
    if (!awaitedKey || !occurrence) {
      return;
    }
    let live = true;
    void explainAwaitedOccurrence(
      occurrence.templateId,
      occurrence.occurredOn,
    ).then((result) => {
      if (live && result.success) {
        setWhy({ key: awaitedKey, miss: result.miss });
      }
    });
    return () => {
      live = false;
    };
    // The key names the occurrence; the object is rebuilt on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [awaitedKey]);

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

  const ink = colors[KIND_INK[current.categoryType]];
  const offersRecord = inThisMonth && !current.awaited;

  return (
    <EntrySheet
      onClose={close}
      title={current.name}
      closeLabel={t("common.close")}
      ink={ink}
      footer={
        outcome ? (
          <Button
            label={t("common.close")}
            variant="outline"
            size="lg"
            disabled={pending}
            onPress={close}
          />
        ) : offersRecord ? (
          <SaveButton
            label={t("planned.recordNow")}
            disabled={pending}
            onPress={() => void record()}
          />
        ) : undefined
      }
    >
      <FigureValue
        value={`${amountSign(current.categoryType)}${formatEuro(current.amount)}`}
        ink={ink}
        caption={t(current.awaited ? "planned.awaitedBody" : "planned.body", {
          date,
        })}
      >
        {/* Dashed, as on the web: a thing expected, not a thing done. */}
        <View
          className="mt-2 flex-row items-center gap-2 rounded-full border border-dashed py-1 pl-1 pr-3"
          style={{ borderColor: colors.hairlineStrong }}
        >
          <View className="h-7 w-7 items-center justify-center rounded-full bg-foreground/5">
            <CategoryGlyph
              icon={current.categoryIcon}
              color={colors.foreground}
              size={ICON.md}
            />
          </View>
          <Text numberOfLines={1} className="text-sm font-medium">
            {current.categoryName}
          </Text>
        </View>
        {why && why.key === awaitedKey && why.miss ? (
          <Text variant="muted" className="mt-2 px-4 text-center text-xs">
            {t("planned.why", {
              reason: describeMiss(why.miss, formatEuro, locale),
            })}
          </Text>
        ) : null}
      </FigureValue>

      {outcome ? (
        <View
          className="mt-6 flex-row items-center gap-2 rounded-2xl border px-3 py-3"
          style={{
            borderColor: withAlpha(colors.success, 0.4),
            backgroundColor: withAlpha(colors.success, 0.06),
          }}
        >
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
            <Text className="text-sm font-medium">{t("planned.undo")}</Text>
          </Pressable>
        </View>
      ) : (
        <View className="mt-6 gap-2">
          {offersRecord ? (
            <Text variant="muted" className="text-center text-xs">
              {t("planned.recordNowHint")}
            </Text>
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
    </EntrySheet>
  );
}

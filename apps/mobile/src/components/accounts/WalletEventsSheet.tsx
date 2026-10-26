import { useState } from "react";
import { Modal, Pressable, ScrollView, View } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import { File } from "expo-file-system";
import { Ionicons } from "@expo/vector-icons";

import { parseTypedAmount } from "@finance/core/amount-input";
import { formatSigned } from "@finance/core/amount-sign";
import { formatShortDate, todayIsoLocal } from "@finance/core/constants";
import { ENVELOPE_SHORT_KEYS } from "@finance/core/future-plan";
import { resolveMessage, type Key } from "@finance/core/i18n/t";
import {
  EVENT_KINDS,
  readBrokerRows,
  type BrokerReading,
  type EventKind,
  type InvestmentEvent,
} from "@finance/core/investment-events";
import type { InvestmentWalletId } from "@finance/core/investments";
import { tableRows } from "@finance/core/statement";

import { NumberField } from "@/components/plan/Fields";
import { ChoiceChips } from "@/components/pickers/ChoiceChips";
import { PrivateAmount } from "@/components/PrivateAmount";
import { Button } from "@/components/ui/Button";
import { ConfirmSheet } from "@/components/ui/ConfirmSheet";
import { DateField } from "@/components/ui/DateField";
import { Input } from "@/components/ui/Input";
import { SheetGrabber } from "@/components/ui/SheetGrabber";
import { Text } from "@/components/ui/Text";
import { cn } from "@/lib/cn";
import { hapticSuccess, hapticWarning } from "@/lib/haptics";
import {
  addInvestmentEvent,
  deleteInvestmentEvent,
  importInvestmentEvents,
} from "@/lib/mutations";
import { useFormatCurrency } from "@/providers/CurrencyProvider";
import { useLocale, useT } from "@/providers/LocaleProvider";
import { useToast } from "@/providers/ToastProvider";
import { ICON } from "@/theme/tokens";
import { useThemeColors } from "@/theme/useThemeColors";

/** The same ceiling as a statement: a broker's year is a few hundred lines. */
const MAX_FILE_BYTES = 10 * 1024 * 1024;

const KIND_KEYS: Record<EventKind, Key> = {
  buy: "events.kindBuy",
  sell: "events.kindSell",
  dividend: "events.kindDividend",
  fee: "events.kindFee",
};

const AMOUNT_HINT_KEYS: Record<EventKind, Key> = {
  buy: "events.amountBuy",
  sell: "events.amountSell",
  dividend: "events.amountDividend",
  fee: "events.amountFee",
};

/** Money in for a sale or a dividend, out for a buy or a fee. */
function signedAmount(event: Pick<InvestmentEvent, "kind" | "amount">): number {
  return event.kind === "sell" || event.kind === "dividend"
    ? event.amount
    : -event.amount;
}

interface Draft {
  kind: EventKind;
  occurredOn: string;
  instrumentName: string;
  isin: string;
  quantity: string;
  amount: number;
  note: string;
}

function emptyDraft(): Draft {
  return {
    kind: "buy",
    occurredOn: todayIsoLocal(),
    instrumentName: "",
    isin: "",
    quantity: "",
    amount: 0,
    note: "",
  };
}

/**
 * « Opérations »: what happened inside one wallet (migration 080) — the
 * web's sheet. The list, one typed by hand, and the broker's export read
 * on the phone (`tableRows` + `readBrokerRows`) and shown before anything
 * is stored; a line already read is known by its fingerprint and never
 * added twice.
 */
export function WalletEventsSheet({
  wallet,
  events,
  onClose,
  onChanged,
}: {
  /** The account; null keeps the sheet closed. */
  wallet: InvestmentWalletId | null;
  /** This wallet's events, newest first. */
  events: InvestmentEvent[];
  onClose: () => void;
  /** Something was written: the screen re-reads. */
  onChanged: () => void;
}) {
  const t = useT();
  const locale = useLocale();
  const colors = useThemeColors();
  const formatEuro = useFormatCurrency();
  const { toast } = useToast();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [pending, setPending] = useState(false);
  const [confirming, setConfirming] = useState<InvestmentEvent | null>(null);
  const [reading, setReading] = useState<BrokerReading | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  if (!wallet) {
    return null;
  }

  function close() {
    setDraft(null);
    setReading(null);
    setProblem(null);
    onClose();
  }

  async function save(current: Draft) {
    if (!wallet) {
      return;
    }
    setPending(true);
    const quantity = current.quantity.trim()
      ? parseTypedAmount(current.quantity)
      : null;
    const result = await addInvestmentEvent({
      wallet,
      kind: current.kind,
      occurredOn: current.occurredOn,
      instrumentName: current.instrumentName,
      isin: current.isin,
      quantity: quantity ?? undefined,
      amount: current.amount,
      note: current.note,
    });
    setPending(false);
    if (!result.success) {
      toast(resolveMessage(t, result.error), "error");
      return;
    }
    void hapticSuccess();
    toast(t("events.added"));
    setDraft(null);
    onChanged();
  }

  async function remove() {
    if (!confirming) {
      return;
    }
    const result = await deleteInvestmentEvent(confirming.id);
    setConfirming(null);
    if (!result.success) {
      toast(resolveMessage(t, result.error), "error");
      return;
    }
    void hapticWarning();
    toast(t("events.deleted"));
    onChanged();
  }

  async function pickFile() {
    if (!wallet) {
      return;
    }
    setProblem(null);
    setReading(null);
    const picked = await DocumentPicker.getDocumentAsync({
      // Brokers give their exports every type and none: the file's
      // content decides what it is.
      type: ["*/*"],
      copyToCacheDirectory: true,
    });
    if (picked.canceled || !picked.assets?.[0]) {
      return;
    }
    const asset = picked.assets[0];
    if ((asset.size ?? 0) > MAX_FILE_BYTES) {
      setProblem(t("statements.tooBig"));
      return;
    }
    setPending(true);
    try {
      const bytes = new Uint8Array(await new File(asset.uri).arrayBuffer());
      const rows = tableRows(bytes);
      if (!rows) {
        setProblem(t("events.importNoTable"));
        return;
      }
      const read = readBrokerRows(rows, wallet);
      if (read.problem === "empty") {
        setProblem(t("events.importEmpty"));
        return;
      }
      if (read.problem === "columns") {
        setProblem(t("events.importNoColumns"));
        return;
      }
      setReading(read);
    } finally {
      setPending(false);
    }
  }

  async function confirmImport(current: BrokerReading) {
    setPending(true);
    const result = await importInvestmentEvents(current.events);
    setPending(false);
    if (!result.success) {
      toast(resolveMessage(t, result.error), "error");
      return;
    }
    void hapticSuccess();
    const known =
      result.known > 0
        ? ` · ${t("events.importedKnown", { count: result.known })}`
        : "";
    toast(
      result.added === 0
        ? t("events.importNone") + known
        : t("events.imported", { count: result.added }) + known,
    );
    setReading(null);
    onChanged();
  }

  const kindOptions = EVENT_KINDS.map((kind) => ({
    value: kind,
    label: t(KIND_KEYS[kind]),
  }));

  return (
    <Modal
      visible
      animationType="fade"
      transparent
      statusBarTranslucent
      onRequestClose={close}
    >
      <View className="flex-1 justify-end bg-black/50">
        <Pressable
          className="flex-1"
          accessibilityLabel={t("events.close")}
          onPress={close}
        />
        <View className="max-h-[92%] rounded-t-card border border-border bg-card">
          <View className="items-center pt-3">
            <SheetGrabber />
          </View>
          <View className="flex-row items-center justify-between px-5 pb-2 pt-3">
            <Text
              accessibilityRole="header"
              className="font-semibold"
              style={{ fontSize: 18 }}
            >
              {t("events.open")} · {t(ENVELOPE_SHORT_KEYS[wallet])}
            </Text>
            <Pressable
              onPress={close}
              accessibilityRole="button"
              accessibilityLabel={t("events.close")}
              className="h-11 justify-center"
            >
              <Text variant="muted">{t("events.close")}</Text>
            </Pressable>
          </View>

          <ScrollView
            className="px-5"
            keyboardShouldPersistTaps="handled"
            automaticallyAdjustKeyboardInsets
            showsVerticalScrollIndicator={false}
            contentContainerClassName="gap-5 pb-8"
          >
            <Text variant="muted" className="text-sm">
              {t("events.intro")}
            </Text>

            {/* The broker's file. */}
            <View className="gap-2 rounded-card border border-border p-4">
              <View className="flex-row">
                <Button
                  label={pending && !reading ? t("events.importing") : t("events.importFile")}
                  variant="outline"
                  size="sm"
                  icon="document-text-outline"
                  disabled={pending}
                  onPress={() => void pickFile()}
                />
              </View>
              <Text variant="muted" className="text-xs">
                {t("events.importHint")}
              </Text>
              {problem ? (
                <Text className="text-sm text-destructive">{problem}</Text>
              ) : null}
              {reading ? (
                <View className="gap-2 border-t border-border pt-3">
                  <Text className="text-sm">
                    {t("events.importRead", { count: reading.events.length })}
                    {reading.skipped > 0
                      ? ` · ${t("events.importSkipped", { count: reading.skipped })}`
                      : ""}
                  </Text>
                  <View className="gap-0.5">
                    {reading.events.slice(0, 30).map((event) => (
                      <View
                        key={event.fingerprint}
                        className="flex-row items-baseline justify-between gap-3"
                      >
                        <Text variant="muted" className="flex-1 text-xs" numberOfLines={1}>
                          {formatShortDate(event.occurredOn, locale)} ·{" "}
                          {t(KIND_KEYS[event.kind])}
                          {event.instrumentName ? ` · ${event.instrumentName}` : ""}
                        </Text>
                        <PrivateAmount className="text-xs text-muted-foreground">
                          {formatSigned(signedAmount(event), formatEuro)}
                        </PrivateAmount>
                      </View>
                    ))}
                  </View>
                  <Text variant="muted" className="text-xs">
                    {t("events.importSynthetic")}
                  </Text>
                  <View className="flex-row flex-wrap gap-2">
                    <Button
                      label={pending ? t("events.adding") : t("events.importConfirm")}
                      size="sm"
                      disabled={pending || reading.events.length === 0}
                      onPress={() => void confirmImport(reading)}
                    />
                    <Button
                      label={t("events.close")}
                      variant="ghost"
                      size="sm"
                      disabled={pending}
                      onPress={() => setReading(null)}
                    />
                  </View>
                </View>
              ) : null}
            </View>

            {/* One typed by hand. */}
            {draft ? (
              <View className="gap-3 rounded-card border border-border p-4">
                <Text className="text-sm font-medium">{t("events.new")}</Text>
                <View className="gap-1">
                  <Text className="text-sm font-medium">{t("events.kind")}</Text>
                  <ChoiceChips
                    options={kindOptions}
                    value={draft.kind}
                    onChange={(kind) => setDraft({ ...draft, kind })}
                    label={t("events.kind")}
                  />
                </View>
                <View className="gap-1">
                  <Text className="text-sm font-medium">{t("events.date")}</Text>
                  <DateField
                    value={draft.occurredOn}
                    onChange={(occurredOn) => setDraft({ ...draft, occurredOn })}
                    accessibilityLabel={t("events.date")}
                  />
                </View>
                <View className="gap-1">
                  <View className="flex-row">
                    <NumberField
                      label={t("events.amount")}
                      kind="money"
                      value={draft.amount}
                      onChange={(amount) => setDraft({ ...draft, amount })}
                    />
                  </View>
                  <Text variant="muted" className="text-xs">
                    {t(AMOUNT_HINT_KEYS[draft.kind])}
                  </Text>
                </View>
                <View className="gap-1">
                  <Text className="text-sm font-medium">{t("events.instrument")}</Text>
                  <Input
                    value={draft.instrumentName}
                    onChangeText={(instrumentName) =>
                      setDraft({ ...draft, instrumentName })
                    }
                    placeholder={t("events.instrumentPlaceholder")}
                    accessibilityLabel={t("events.instrument")}
                    maxLength={200}
                  />
                </View>
                <View className="gap-1">
                  <Text className="text-sm font-medium">{t("events.isin")}</Text>
                  <Input
                    value={draft.isin}
                    onChangeText={(isin) => setDraft({ ...draft, isin })}
                    accessibilityLabel={t("events.isin")}
                    autoCapitalize="characters"
                    maxLength={12}
                  />
                  <Text variant="muted" className="text-xs">
                    {t("events.isinHint")}
                  </Text>
                </View>
                {draft.kind === "buy" || draft.kind === "sell" ? (
                  <View className="gap-1">
                    <Text className="text-sm font-medium">{t("events.quantity")}</Text>
                    <Input
                      value={draft.quantity}
                      onChangeText={(quantity) => setDraft({ ...draft, quantity })}
                      accessibilityLabel={t("events.quantity")}
                      keyboardType="decimal-pad"
                    />
                  </View>
                ) : null}
                <View className="gap-1">
                  <Text className="text-sm font-medium">{t("events.note")}</Text>
                  <Input
                    value={draft.note}
                    onChangeText={(note) => setDraft({ ...draft, note })}
                    accessibilityLabel={t("events.note")}
                    maxLength={500}
                  />
                </View>
                <View className="flex-row flex-wrap gap-2">
                  <Button
                    label={pending ? t("events.adding") : t("events.add")}
                    size="sm"
                    disabled={pending}
                    onPress={() => void save(draft)}
                  />
                  <Button
                    label={t("events.close")}
                    variant="ghost"
                    size="sm"
                    disabled={pending}
                    onPress={() => setDraft(null)}
                  />
                </View>
              </View>
            ) : (
              <View className="flex-row">
                <Button
                  label={t("events.new")}
                  variant="secondary"
                  size="sm"
                  onPress={() => setDraft(emptyDraft())}
                />
              </View>
            )}

            {/* The list. */}
            {events.length === 0 ? (
              <View className="gap-1">
                <Text className="text-sm font-medium">{t("events.empty")}</Text>
                <Text variant="muted" className="text-sm">
                  {t("events.emptyBody")}
                </Text>
              </View>
            ) : (
              <View>
                {events.map((event, index) => (
                  <View
                    key={event.id}
                    className={cn(
                      "flex-row items-center justify-between gap-3 py-2",
                      index > 0 && "border-t border-border",
                    )}
                  >
                    <View className="flex-1 gap-0.5">
                      <Text className="text-sm" numberOfLines={1}>
                        {t(KIND_KEYS[event.kind])}
                        {event.instrumentName ? ` · ${event.instrumentName}` : ""}
                      </Text>
                      <Text variant="muted" className="text-xs">
                        {formatShortDate(event.occurredOn, locale)}{" "}
                        {event.occurredOn.slice(0, 4)}
                        {event.quantity ? ` · ${event.quantity}` : ""}
                        {event.source === "file" ? ` · ${t("events.fromFile")}` : ""}
                      </Text>
                    </View>
                    <PrivateAmount
                      className={cn(
                        "text-sm",
                        signedAmount(event) > 0 ? "text-success" : "text-foreground",
                      )}
                    >
                      {formatSigned(signedAmount(event), formatEuro)}
                    </PrivateAmount>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={t("events.deleteNamed", {
                        date: formatShortDate(event.occurredOn, locale),
                      })}
                      onPress={() => setConfirming(event)}
                      className="h-11 w-11 items-center justify-center rounded-full"
                    >
                      <Ionicons
                        name="trash-outline"
                        size={ICON.md}
                        color={colors.mutedForeground}
                      />
                    </Pressable>
                  </View>
                ))}
              </View>
            )}
          </ScrollView>
        </View>
      </View>

      <ConfirmSheet
        open={confirming !== null}
        title={t("events.delete")}
        message={
          confirming
            ? t("events.deleteNamed", {
                date: formatShortDate(confirming.occurredOn, locale),
              })
            : ""
        }
        confirmLabel={t("events.delete")}
        onConfirm={() => void remove()}
        onCancel={() => setConfirming(null)}
      />
    </Modal>
  );
}

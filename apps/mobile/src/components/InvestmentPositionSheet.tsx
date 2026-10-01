import { useState } from "react";
import { Linking, Modal, Pressable, ScrollView, View } from "react-native";

import type { InvestmentPositionItem } from "@finance/core/investment-positions";
import { isCryptoWallet } from "@finance/core/crypto-holdings";
import { parseTypedAmount } from "@finance/core/amount-input";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import {
  chargeLookupUrl,
  chargeToInput,
  parseChargeInput,
} from "@finance/core/fund-costs";
import { Text } from "@/components/ui/Text";
import { SheetGrabber } from "@/components/ui/SheetGrabber";
import { toTypedAmount } from "@/lib/typed-amount";
import { useLocale, useT } from "@/providers/LocaleProvider";
import { resolveMessage } from "@finance/core/i18n/t";
import {
  removeInvestmentPosition,
  saveInvestmentPosition,
} from "@/lib/mutations";

interface InvestmentPositionSheetProps {
  /**
   * The position being edited. Mount the sheet only while there is one, and
   * keyed by its id: the fields are seeded from it once, and a sheet that
   * stayed mounted while closed seeded them from nothing — so opening a
   * position showed empty fields, and Save wrote 0 as what was put in.
   */
  item: InvestmentPositionItem;
  onClose: () => void;
  onSaved: () => void;
}


/**
 * A share count, which is not money: "0,005" bitcoin is five thousandths,
 * where `parseTypedAmount` would read three digits after a separator as a
 * thousands group. So the comma is only ever a decimal point here.
 */
function parseShareCount(value: string): number | null {
  const trimmed = value.replace(/\s/g, "");
  if (!trimmed) {
    return null;
  }
  const parsed = Number(trimmed.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

/** Edits a wallet position's figures, mirroring the web position sheet. */
export function InvestmentPositionSheet({
  item,
  onClose,
  onSaved,
}: InvestmentPositionSheetProps) {
  const t = useT();
  const locale = useLocale();
  // In the reader's own shape — "1500,5" in French — so `parseTypedAmount`
  // reads back exactly what was put in.
  const [initialBalance, setInitialBalance] = useState(() =>
    toTypedAmount(item.initialBalance, locale),
  );
  const [currentValue, setCurrentValue] = useState(() =>
    item.currentValue != null ? toTypedAmount(item.currentValue, locale) : "",
  );
  const [shareCount, setShareCount] = useState(
    item.shareCount != null ? String(item.shareCount) : "",
  );
  const [ongoingCharge, setOngoingCharge] = useState(
    chargeToInput(item.ongoingCharge ?? null),
  );
  const lookupUrl = chargeLookupUrl(
    item.instrumentSymbol ?? null,
    item.instrumentName ?? null,
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const isCrypto = isCryptoWallet(item.walletId);

  async function handleSave() {
    setPending(true);
    setError(null);
    const result = await saveInvestmentPosition({
      positionId: item.id,
      // « 1 234,56 » as well as "1234.56". Empty is nothing put in yet.
      initialBalance: parseTypedAmount(initialBalance) ?? 0,
      currentValue: parseTypedAmount(currentValue),
      shareCount: parseShareCount(shareCount),
      ongoingCharge: parseChargeInput(ongoingCharge),
    });
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
    const result = await removeInvestmentPosition(item.id);
    setPending(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    onSaved();
    onClose();
  }

  return (
    <Modal
      visible
      animationType="slide"
      transparent
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View className="flex-1 justify-end bg-black/50">
        <Pressable
          className="flex-1"
          accessibilityLabel={t("position.close")}
          onPress={onClose}
        />
        <View className="max-h-[90%] rounded-t-card border border-border bg-card">
          <View className="items-center pt-3">
            <SheetGrabber />
          </View>
          <View className="flex-row items-center justify-between px-5 pb-2 pt-3">
            <Text className="font-semibold" style={{ fontSize: 18 }}>
              {item.name}
            </Text>
            <Pressable
              onPress={onClose}
              accessibilityLabel={t("position.close")}
              hitSlop={8}
            >
              <Text variant="muted">{t("position.close")}</Text>
            </Pressable>
          </View>

          <ScrollView
            className="px-5"
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <Text className="mb-2 text-sm font-medium">
              {t("position.costBasis")}
            </Text>
            <Text variant="muted" className="mb-2 text-xs">
              {t("position.costBasisHint")}
            </Text>
            <Input
              value={initialBalance}
              onChangeText={setInitialBalance}
              keyboardType="decimal-pad"
              placeholder="0"
              className="mb-4"
            />

            <Text className="mb-2 text-sm font-medium">
              {isCrypto ? t("position.totalBtc") : t("position.totalShares")}
            </Text>
            <Text variant="muted" className="mb-2 text-xs">
              {isCrypto ? t("position.btcHint") : t("position.sharesHint")}
            </Text>
            <Input
              value={shareCount}
              onChangeText={setShareCount}
              keyboardType="decimal-pad"
              placeholder="0"
              className="mb-4"
            />

            <Text className="mb-2 text-sm font-medium">
              {t("position.brokerValue")}
            </Text>
            <Text variant="muted" className="mb-2 text-xs">
              {t("position.manualValueHint")}
            </Text>
            <Input
              value={currentValue}
              onChangeText={setCurrentValue}
              keyboardType="decimal-pad"
              placeholder={t("position.marketValuePlaceholder")}
              className="mb-4"
            />

            <Text className="mb-2 text-sm font-medium">
              {t("position.ongoingChargeLabel")}
            </Text>
            <Text variant="muted" className="mb-2 text-xs">
              {t("position.ongoingChargeHint")}
            </Text>
            <Input
              value={ongoingCharge}
              onChangeText={setOngoingCharge}
              keyboardType="decimal-pad"
              placeholder={t("position.chargePlaceholder")}
              className="mb-2"
            />
            {lookupUrl ? (
              <Pressable
                accessibilityRole="link"
                accessibilityLabel={t("position.lookUpCharge")}
                onPress={() => {
                  void Linking.openURL(lookupUrl);
                }}
                className="mb-4 self-start"
              >
                <Text className="text-xs text-primary-ink underline">
                  {t("position.lookUpCharge")}
                </Text>
              </Pressable>
            ) : (
              <View className="mb-4" />
            )}

            {error ? (
              <Text className="mb-3 text-sm text-destructive">
                {resolveMessage(t, error)}
              </Text>
            ) : null}

            <Button
              label={
                pending ? t("position.saving") : t("position.savePosition")
              }
              size="lg"
              disabled={pending}
              onPress={handleSave}
            />

            <View className="mt-6 gap-3 border-t border-border pt-4">
              {confirmDelete ? (
                <View className="gap-2">
                  <Text variant="muted" className="text-sm">
                    {t("position.removeConfirmBody")}
                  </Text>
                  <View className="flex-row gap-2">
                    <Button
                      label={
                        pending
                          ? t("position.removing")
                          : t("position.confirmRemove")
                      }
                      variant="outline"
                      className="flex-1 border-destructive"
                      disabled={pending}
                      onPress={handleDelete}
                    />
                    <Button
                      label={t("position.cancel")}
                      variant="outline"
                      className="flex-1"
                      disabled={pending}
                      onPress={() => setConfirmDelete(false)}
                    />
                  </View>
                </View>
              ) : (
                <Button
                  label={t("position.removePosition")}
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

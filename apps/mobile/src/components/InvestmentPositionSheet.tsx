import { useState } from "react";
import { Linking, Pressable, View } from "react-native";

import type { InvestmentPositionItem } from "@finance/core/investment-positions";
import { isCryptoWallet } from "@finance/core/crypto-holdings";
import { parseTypedAmount } from "@finance/core/amount-input";

import { formatSigned } from "@finance/core/amount-sign";

import {
  DangerAction,
  EntrySheet,
  Field,
  FigureValue,
  SaveButton,
} from "@/components/sheet/EntrySheet";
import { Input } from "@/components/ui/Input";
import {
  chargeLookupUrl,
  chargeToInput,
  parseChargeInput,
} from "@finance/core/fund-costs";
import { Text } from "@/components/ui/Text";
import { toTypedAmount } from "@/lib/typed-amount";
import { useFormatCurrency } from "@/providers/CurrencyProvider";
import { usePrivacy } from "@/providers/PrivacyProvider";
import { useLocale, useT } from "@/providers/LocaleProvider";
import { useThemeColors } from "@/theme/useThemeColors";
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

/**
 * Edits a wallet position's figures, mirroring the web position sheet. In
 * the entry sheets' language since November 2026: what the line is worth
 * today as the figure at the top, in the investment colour, with what was
 * put in and the gain under it; the four figures a person can correct
 * below; removing it at the bottom, in words.
 */
export function InvestmentPositionSheet({
  item,
  onClose,
}: InvestmentPositionSheetProps) {
  const t = useT();
  const locale = useLocale();
  // In the reader's own shape — "1500,5" in French — so `parseTypedAmount`
  // reads back exactly what was put in.
  const [initialBalance, setInitialBalance] = useState(() =>
    toTypedAmount(item.totalInvested, locale),
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
    onClose();
  }

  const colors = useThemeColors();
  const formatEuro = useFormatCurrency();
  const { hidden } = usePrivacy();
  const ink = colors.info;
  const gain =
    item.totalInvested > 0
      ? formatSigned(item.gainLoss, formatEuro)
      : null;

  return (
    <EntrySheet
      onClose={onClose}
      title={item.name}
      closeLabel={t("position.close")}
      ink={ink}
      footer={
        <SaveButton
          label={pending ? t("position.saving") : t("position.savePosition")}
          disabled={pending}
          onPress={() => void handleSave()}
        />
      }
    >
      <FigureValue
        value={formatEuro(item.marketValue)}
        ink={ink}
        caption={
          hidden
            ? undefined
            : [`${formatEuro(item.totalInvested)} ${t("position.amountIn")}`, gain]
                .filter(Boolean)
                .join(" · ")
        }
      />

      <View className="mt-5 gap-4">
        <Field label={t("position.costBasis")} hint={t("position.costBasisHint")}>
          <Input
            value={initialBalance}
            onChangeText={setInitialBalance}
            keyboardType="decimal-pad"
            placeholder="0"
            tone="sheet"
          />
        </Field>

        <Field
          label={isCrypto ? t("position.totalBtc") : t("position.totalShares")}
          hint={isCrypto ? t("position.btcHint") : t("position.sharesHint")}
        >
          <Input
            value={shareCount}
            onChangeText={setShareCount}
            keyboardType="decimal-pad"
            placeholder="0"
            tone="sheet"
          />
        </Field>

        <Field
          label={t("position.brokerValue")}
          hint={t("position.manualValueHint")}
        >
          <Input
            value={currentValue}
            onChangeText={setCurrentValue}
            keyboardType="decimal-pad"
            placeholder={t("position.marketValuePlaceholder")}
            tone="sheet"
          />
        </Field>

        <Field
          label={t("position.ongoingChargeLabel")}
          hint={t("position.ongoingChargeHint")}
        >
          <Input
            value={ongoingCharge}
            onChangeText={setOngoingCharge}
            keyboardType="decimal-pad"
            placeholder={t("position.chargePlaceholder")}
            tone="sheet"
          />
          {lookupUrl ? (
            <Pressable
              accessibilityRole="link"
              accessibilityLabel={t("position.lookUpCharge")}
              onPress={() => {
                void Linking.openURL(lookupUrl);
              }}
              className="mt-1 self-start"
            >
              <Text className="text-xs text-primary-ink underline">
                {t("position.lookUpCharge")}
              </Text>
            </Pressable>
          ) : null}
        </Field>

        {error ? (
          <Text className="text-sm text-destructive">
            {resolveMessage(t, error)}
          </Text>
        ) : null}
      </View>

      <View className="mt-6 border-t border-border pt-4">
        <DangerAction
          label={t("position.removePosition")}
          explanation={t("position.removeConfirmBody")}
          confirmLabel={
            pending ? t("position.removing") : t("position.confirmRemove")
          }
          cancelLabel={t("position.cancel")}
          pending={pending}
          onConfirm={() => void handleDelete()}
        />
      </View>
    </EntrySheet>
  );
}

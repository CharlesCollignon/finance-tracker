import { useState } from "react";
import { View } from "react-native";

import { ENVELOPE_SHORT_KEYS } from "@finance/core/future-plan";
import { resolveMessage } from "@finance/core/i18n/t";
import type { WalletId } from "@finance/core/types/database";

import { NumberField } from "@/components/plan/Fields";
import { Input } from "@/components/ui/Input";
import { EntrySheet, SaveButton } from "@/components/sheet/EntrySheet";
import { useThemeColors } from "@/theme/useThemeColors";
import { Text } from "@/components/ui/Text";
import { hapticSuccess } from "@/lib/haptics";
import { createInvestmentPosition } from "@/lib/savings-accounts";
import { useT } from "@/providers/LocaleProvider";

/**
 * A holding typed in by hand — the web's custom line: a name, what it cost,
 * what it is worth. A holding bought every month is better made from its
 * recurring entry, which keeps it up to date on its own; this is for the
 * rest, and for an account just added that holds nothing yet.
 */
export function NewPositionSheet({
  wallet,
  onClose,
}: {
  /** The account it goes in; null keeps the sheet closed. */
  wallet: WalletId | null;
  onClose: () => void;
}) {
  const colors = useThemeColors();
  const t = useT();
  const [name, setName] = useState("");
  const [invested, setInvested] = useState(0);
  const [value, setValue] = useState(0);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!wallet) {
    return null;
  }

  function close() {
    setName("");
    setInvested(0);
    setValue(0);
    setError(null);
    onClose();
  }

  async function save() {
    if (!wallet) {
      return;
    }
    setPending(true);
    setError(null);
    const result = await createInvestmentPosition({
      wallet,
      name,
      initialBalance: invested,
      currentValue: value > 0 ? value : null,
    });
    setPending(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    void hapticSuccess();
    close();
  }

  return (
    <EntrySheet
      onClose={close}
      title={`${t("position.addItem")} · ${t(ENVELOPE_SHORT_KEYS[wallet])}`}
      closeLabel={t("position.close")}
      ink={colors.info}
      footer={
        <SaveButton
          label={
            pending
              ? t("position.saving")
              : name.trim() === ""
                ? t("entry.gap.name")
                : t("position.savePosition")
          }
          disabled={pending || name.trim() === ""}
          onPress={() => void save()}
        />
      }
    >
            <View className="gap-4">
              <View className="gap-1">
                <Text className="text-xs font-semibold text-muted-foreground">
                  {t("position.nameLabel")}
                </Text>
                <Input
                  tone="sheet"
                  value={name}
                  onChangeText={setName}
                  placeholder={t("position.namePlaceholder")}
                  accessibilityLabel={t("position.nameLabel")}
                  maxLength={120}
                />
              </View>

              <View className="gap-1">
                <View className="flex-row">
                  <NumberField
                    label={t("position.costBasis")}
                    kind="money"
                    value={invested}
                    onChange={setInvested}
                  />
                </View>
                <Text variant="muted" className="text-xs">
                  {t("position.costBasisHint")}
                </Text>
              </View>

              <View className="gap-1">
                <View className="flex-row">
                  <NumberField
                    label={t("position.brokerValue")}
                    kind="money"
                    value={value}
                    onChange={setValue}
                  />
                </View>
                <Text variant="muted" className="text-xs">
                  {t("position.manualValueHint")}
                </Text>
              </View>

              {error ? (
                <Text className="text-sm text-destructive">
                  {resolveMessage(t, error)}
                </Text>
              ) : null}

            </View>
    </EntrySheet>
  );
}

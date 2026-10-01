import { useState } from "react";
import { Modal, Pressable, ScrollView, View } from "react-native";

import { ENVELOPE_SHORT_KEYS } from "@finance/core/future-plan";
import { resolveMessage } from "@finance/core/i18n/t";
import type { WalletId } from "@finance/core/types/database";

import { NumberField } from "@/components/plan/Fields";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { SheetGrabber } from "@/components/ui/SheetGrabber";
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
  onSaved,
}: {
  /** The account it goes in; null keeps the sheet closed. */
  wallet: WalletId | null;
  onClose: () => void;
  onSaved: () => void;
}) {
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
    onSaved();
    close();
  }

  return (
    <Modal
      visible
      animationType="slide"
      transparent
      statusBarTranslucent
      onRequestClose={close}
    >
      <View className="flex-1 justify-end bg-black/50">
        <Pressable
          className="flex-1"
          accessibilityLabel={t("position.close")}
          onPress={close}
        />
        <View className="max-h-[90%] rounded-t-card border border-border bg-card">
          <View className="items-center pt-3">
            <SheetGrabber />
          </View>
          <View className="flex-row items-center justify-between px-5 pb-2 pt-3">
            <Text
              accessibilityRole="header"
              className="font-semibold"
              style={{ fontSize: 18 }}
            >
              {t("position.addItem")} · {t(ENVELOPE_SHORT_KEYS[wallet])}
            </Text>
            <Pressable
              onPress={close}
              accessibilityRole="button"
              accessibilityLabel={t("position.close")}
              className="h-11 justify-center"
            >
              <Text variant="muted">{t("position.close")}</Text>
            </Pressable>
          </View>

          <ScrollView
            className="px-5"
            keyboardShouldPersistTaps="handled"
            automaticallyAdjustKeyboardInsets
            showsVerticalScrollIndicator={false}
          >
            <View className="gap-4">
              <View className="gap-1">
                <Text className="text-sm font-medium">
                  {t("position.nameLabel")}
                </Text>
                <Input
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

              <Button
                label={
                  pending ? t("position.saving") : t("position.savePosition")
                }
                size="lg"
                disabled={pending || name.trim() === ""}
                onPress={() => void save()}
              />
            </View>
            <View className="h-10" />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

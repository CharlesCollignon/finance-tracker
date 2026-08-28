import { useState } from "react";
import { Modal, Pressable, ScrollView, View } from "react-native";

import type { InvestmentPositionItem } from "@finance/core/investment-positions";
import { isCryptoWallet } from "@finance/core/crypto-holdings";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Text } from "@/components/ui/Text";
import {
  removeInvestmentPosition,
  saveInvestmentPosition,
} from "@/lib/mutations";

interface InvestmentPositionSheetProps {
  item: InvestmentPositionItem | null;
  onClose: () => void;
  onSaved: () => void;
}

function toNumberOrNull(value: string): number | null {
  const trimmed = value.trim();
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
  const [initialBalance, setInitialBalance] = useState(
    item ? String(item.initialBalance) : "",
  );
  const [currentValue, setCurrentValue] = useState(
    item?.currentValue != null ? String(item.currentValue) : "",
  );
  const [shareCount, setShareCount] = useState(
    item?.shareCount != null ? String(item.shareCount) : "",
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (!item) {
    return null;
  }

  const isCrypto = isCryptoWallet(item.walletId);

  async function handleSave() {
    if (!item) {
      return;
    }
    setPending(true);
    setError(null);
    const result = await saveInvestmentPosition({
      positionId: item.id,
      initialBalance: Number(initialBalance.replace(",", ".")) || 0,
      currentValue: toNumberOrNull(currentValue),
      shareCount: toNumberOrNull(shareCount),
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
    if (!item) {
      return;
    }
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
          accessibilityLabel="Close"
          onPress={onClose}
        />
        <View className="max-h-[90%] rounded-t-3xl border border-border bg-card">
          <View className="items-center pt-3">
            <View className="h-1 w-10 rounded-full bg-hairline-strong" />
          </View>
          <View className="flex-row items-center justify-between px-5 pb-2 pt-3">
            <Text className="font-semibold" style={{ fontSize: 18 }}>
              {item.name}
            </Text>
            <Pressable onPress={onClose} accessibilityLabel="Close" hitSlop={8}>
              <Text variant="muted">Close</Text>
            </Pressable>
          </View>

          <ScrollView
            className="px-5"
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <Text className="mb-2 text-sm font-medium">
              Starting balance (EUR)
            </Text>
            <Text variant="muted" className="mb-2 text-xs">
              Counts toward invested and P/L — not updated from recurring
              transactions.
            </Text>
            <Input
              value={initialBalance}
              onChangeText={setInitialBalance}
              keyboardType="decimal-pad"
              placeholder="0.00"
              className="mb-4"
            />

            <Text className="mb-2 text-sm font-medium">
              {isCrypto ? "Total BTC" : "Total shares"}
            </Text>
            <Text variant="muted" className="mb-2 text-xs">
              Needed for a live market value.
            </Text>
            <Input
              value={shareCount}
              onChangeText={setShareCount}
              keyboardType="decimal-pad"
              placeholder="0"
              className="mb-4"
            />

            <Text className="mb-2 text-sm font-medium">
              Manual value (EUR, optional)
            </Text>
            <Text variant="muted" className="mb-2 text-xs">
              Overrides the market quote when set.
            </Text>
            <Input
              value={currentValue}
              onChangeText={setCurrentValue}
              keyboardType="decimal-pad"
              placeholder="Leave empty to use market"
              className="mb-4"
            />

            {error ? (
              <Text className="mb-3 text-sm text-destructive">{error}</Text>
            ) : null}

            <Button
              label={pending ? "Saving…" : "Save position"}
              size="lg"
              disabled={pending}
              onPress={handleSave}
            />

            <View className="mt-6 gap-3 border-t border-border pt-4">
              {confirmDelete ? (
                <View className="gap-2">
                  <Text variant="muted" className="text-sm">
                    Remove this position? Its transactions stay; only the
                    tracked position is deleted.
                  </Text>
                  <View className="flex-row gap-2">
                    <Button
                      label={pending ? "Removing…" : "Yes, remove"}
                      variant="outline"
                      className="flex-1 border-destructive"
                      disabled={pending}
                      onPress={handleDelete}
                    />
                    <Button
                      label="Cancel"
                      variant="outline"
                      className="flex-1"
                      disabled={pending}
                      onPress={() => setConfirmDelete(false)}
                    />
                  </View>
                </View>
              ) : (
                <Button
                  label="Remove position"
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

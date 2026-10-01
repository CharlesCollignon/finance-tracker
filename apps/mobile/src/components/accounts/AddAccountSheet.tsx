import { useState } from "react";
import { Modal, Pressable, ScrollView, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import {
  ENVELOPE_NAME_KEYS,
  ENVELOPE_SHORT_KEYS,
} from "@finance/core/future-plan";
import { resolveMessage } from "@finance/core/i18n/t";
import { INVESTMENT_WALLET_IDS } from "@finance/core/investments";
import {
  FRENCH_SAVINGS_2026,
  SAVINGS_KINDS,
  SAVINGS_KIND_RATE_KEYS,
} from "@finance/core/savings-accounts";
import type {
  BankAccount,
  SavingsAccountKind,
  WalletId,
} from "@finance/core/types/database";

import { NumberField } from "@/components/plan/Fields";
import { Button } from "@/components/ui/Button";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { SheetGrabber } from "@/components/ui/SheetGrabber";
import { Text } from "@/components/ui/Text";
import { cn } from "@/lib/cn";
import { hapticLight, hapticSuccess } from "@/lib/haptics";
import { addSavingsAccount, showWallet } from "@/lib/savings-accounts";
import { useFormatCurrency } from "@/providers/CurrencyProvider";
import { useT } from "@/providers/LocaleProvider";
import { useToast } from "@/providers/ToastProvider";
import { ICON } from "@/theme/tokens";
import { useThemeColors } from "@/theme/useThemeColors";

export type AccountKey = SavingsAccountKind | WalletId;

/** A PEL keeps its opening year's rate, a bank livret its bank's. */
const OWN_RATE: readonly SavingsAccountKind[] = ["pel", "livret"];

/**
 * Adding an account: pick the kind, and for a savings account say what is
 * in it — or read it from the bank, when the bank reports that account.
 * Only the kinds not already there are offered.
 */
export function AddAccountSheet({
  open,
  takenSavings,
  takenWallets,
  bankAccounts,
  onClose,
  onAdded,
}: {
  open: boolean;
  takenSavings: readonly SavingsAccountKind[];
  takenWallets: readonly WalletId[];
  /** The bank accounts a new savings account could read its balance from. */
  bankAccounts: readonly BankAccount[];
  onClose: () => void;
  onAdded: (key: AccountKey) => void;
}) {
  const t = useT();
  const { toast } = useToast();
  const colors = useThemeColors();
  const [kind, setKind] = useState<SavingsAccountKind | null>(null);
  const [balance, setBalance] = useState(0);
  const [rate, setRate] = useState(0);
  const [source, setSource] = useState<"typed" | "bank">("typed");
  const [bankId, setBankId] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const savings = SAVINGS_KINDS.filter((id) => !takenSavings.includes(id));
  const wallets = INVESTMENT_WALLET_IDS.filter(
    (id) => !takenWallets.includes(id),
  );

  function close() {
    setKind(null);
    setBalance(0);
    setSource("typed");
    setBankId(null);
    setError(null);
    onClose();
  }

  function pickSavings(next: SavingsAccountKind) {
    void hapticLight();
    setKind(next);
    setRate(FRENCH_SAVINGS_2026[next].rate);
    setBalance(0);
    setSource("typed");
    setBankId(null);
    setError(null);
  }

  async function addWallet(wallet: WalletId) {
    setPending(true);
    setError(null);
    const result = await showWallet(wallet);
    setPending(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    void hapticSuccess();
    toast(t("accounts.added", { name: t(ENVELOPE_SHORT_KEYS[wallet]) }));
    onAdded(wallet);
    close();
  }

  async function confirmSavings() {
    if (!kind) {
      return;
    }
    const bank =
      source === "bank"
        ? bankAccounts.find((account) => account.provider_account_id === bankId)
        : undefined;
    if (source === "bank" && !bank) {
      setError("errors.invalidInput");
      return;
    }
    setPending(true);
    setError(null);
    const name = t(ENVELOPE_SHORT_KEYS[kind]);
    const preset = FRENCH_SAVINGS_2026[kind].rate;
    const result = await addSavingsAccount({
      kind,
      categoryName: name,
      // Kept beside the link, so stopping it later leaves a balance behind.
      balance: bank ? Math.max(0, Number(bank.reported_balance ?? 0)) : balance,
      annualRate:
        OWN_RATE.includes(kind) && Math.abs(rate - preset) > 1e-9 ? rate : null,
      bankAccountId: bank?.provider_account_id ?? null,
    });
    setPending(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    void hapticSuccess();
    toast(
      t("accounts.addedSavings", {
        name,
        category: result.categoryName ?? name,
      }),
    );
    onAdded(kind);
    close();
  }

  return (
    <Modal
      visible={open}
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
            <View className="flex-row items-center gap-2">
              {kind ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t("accounts.addTitle")}
                  onPress={() => setKind(null)}
                  className="-ml-2 h-11 w-11 items-center justify-center"
                >
                  <Ionicons
                    name="chevron-back"
                    size={ICON.lg}
                    color={colors.foreground}
                  />
                </Pressable>
              ) : null}
              <Text
                accessibilityRole="header"
                className="font-semibold"
                style={{ fontSize: 18 }}
              >
                {kind ? t(ENVELOPE_SHORT_KEYS[kind]) : t("accounts.addTitle")}
              </Text>
            </View>
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
            {kind ? (
              <View className="gap-4 pb-2">
                <Text variant="muted" className="text-sm">
                  {t(ENVELOPE_NAME_KEYS[kind])}
                </Text>

                {bankAccounts.length > 0 ? (
                  <SegmentedControl
                    label={t("accounts.addBalance")}
                    segments={[
                      { value: "typed", label: t("accounts.addTypeIt") },
                      { value: "bank", label: t("accounts.addFromBank") },
                    ]}
                    value={source}
                    onChange={setSource}
                  />
                ) : null}

                {source === "bank" && bankAccounts.length > 0 ? (
                  <BankChoice
                    accounts={bankAccounts}
                    value={bankId}
                    onChange={setBankId}
                  />
                ) : (
                  <View className="gap-1">
                    <Text className="text-sm font-medium">
                      {t("accounts.addBalance")}
                    </Text>
                    <View className="flex-row">
                      <NumberField
                        label={t("futurePlan.fieldInitial")}
                        kind="money"
                        value={balance}
                        onChange={setBalance}
                      />
                    </View>
                  </View>
                )}

                {OWN_RATE.includes(kind) ? (
                  <View className="gap-1">
                    <View className="flex-row">
                      <NumberField
                        label={t("accounts.addRate")}
                        kind="percent"
                        value={rate}
                        max={0.2}
                        onChange={setRate}
                      />
                    </View>
                    <Text variant="muted" className="text-xs">
                      {t(SAVINGS_KIND_RATE_KEYS[kind])}
                    </Text>
                  </View>
                ) : null}

                {error ? (
                  <Text className="text-sm text-destructive">
                    {resolveMessage(t, error)}
                  </Text>
                ) : null}

                <Button
                  label={
                    pending ? t("common.working") : t("accounts.addConfirm")
                  }
                  size="lg"
                  variant="default"
                  disabled={pending || (source === "bank" && !bankId)}
                  onPress={() => void confirmSavings()}
                />
              </View>
            ) : (
              <View className="gap-5 pb-2">
                {savings.length === 0 && wallets.length === 0 ? (
                  <Text variant="muted" className="text-sm">
                    {t("accounts.allAdded")}
                  </Text>
                ) : null}

                {savings.length > 0 ? (
                  <KindGroup
                    title={t("accounts.savingsGroup")}
                    kinds={savings}
                    disabled={pending}
                    onPick={(id) => pickSavings(id as SavingsAccountKind)}
                  />
                ) : null}

                {wallets.length > 0 ? (
                  <KindGroup
                    title={t("accounts.investGroup")}
                    kinds={wallets}
                    disabled={pending}
                    onPick={(id) => void addWallet(id as WalletId)}
                  />
                ) : null}

                {error ? (
                  <Text className="text-sm text-destructive">
                    {resolveMessage(t, error)}
                  </Text>
                ) : null}
              </View>
            )}
            <View className="h-10" />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function KindGroup({
  title,
  kinds,
  disabled,
  onPick,
}: {
  title: string;
  kinds: readonly AccountKey[];
  disabled: boolean;
  onPick: (kind: AccountKey) => void;
}) {
  const t = useT();
  const colors = useThemeColors();
  return (
    <View className="gap-2">
      <Text variant="muted" accessibilityRole="header" className="text-xs">
        {title}
      </Text>
      <View className="overflow-hidden rounded-card border border-border">
        {kinds.map((id, index) => {
          const name = t(ENVELOPE_SHORT_KEYS[id]);
          const full = t(ENVELOPE_NAME_KEYS[id]);
          return (
            <Pressable
              key={id}
              accessibilityRole="button"
              accessibilityLabel={full === name ? name : `${name}, ${full}`}
              disabled={disabled}
              onPress={() => onPick(id)}
              className={cn(
                "min-h-14 flex-row items-center justify-between gap-3 px-4 py-2.5",
                index > 0 && "border-t border-border",
              )}
            >
              <View className="min-w-0 flex-1">
                <Text className="font-medium">{name}</Text>
                {full !== name ? (
                  <Text variant="muted" numberOfLines={1} className="text-xs">
                    {full}
                  </Text>
                ) : null}
              </View>
              <Ionicons
                name="add"
                size={ICON.md}
                color={colors.mutedForeground}
              />
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/** The bank's accounts, with what each reported, to read a balance from. */
export function BankChoice({
  accounts,
  value,
  onChange,
}: {
  accounts: readonly BankAccount[];
  value: string | null;
  onChange: (id: string) => void;
}) {
  const t = useT();
  const formatEuro = useFormatCurrency();
  const colors = useThemeColors();
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={t("accounts.addFromBank")}
      className="overflow-hidden rounded-card border border-border"
    >
      {accounts.map((account, index) => {
        const selected = account.provider_account_id === value;
        return (
          <Pressable
            key={account.provider_account_id}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            onPress={() => {
              void hapticLight();
              onChange(account.provider_account_id);
            }}
            className={cn(
              "min-h-12 flex-row items-center justify-between gap-3 px-4 py-2.5",
              index > 0 && "border-t border-border",
            )}
          >
            <Text className="min-w-0 flex-1" numberOfLines={1}>
              {account.reported_balance === null
                ? account.label
                : t("placementsPhone.bankAccountOption", {
                    name: account.label,
                    amount: formatEuro(Number(account.reported_balance)),
                  })}
            </Text>
            <Ionicons
              name={selected ? "radio-button-on" : "radio-button-off"}
              size={ICON.md}
              color={selected ? colors.foreground : colors.mutedForeground}
            />
          </Pressable>
        );
      })}
    </View>
  );
}

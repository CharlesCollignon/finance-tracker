import { useState } from "react";
import { View } from "react-native";

import { formatShortDate } from "@finance/core/constants";
import {
  ENVELOPE_NAME_KEYS,
  ENVELOPE_SHORT_KEYS,
} from "@finance/core/future-plan";
import { resolveMessage } from "@finance/core/i18n/t";
import {
  FRENCH_SAVINGS_2026,
  SAVINGS_KIND_RATE_KEYS,
  SAVINGS_KIND_TAX_KEYS,
  yearlyInterest,
} from "@finance/core/savings-accounts";
import type { BankAccount } from "@finance/core/types/database";

import { AnimatedAmount } from "@/components/AnimatedAmount";
import { NumberField } from "@/components/plan/Fields";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ConfirmSheet } from "@/components/ui/ConfirmSheet";
import { Text } from "@/components/ui/Text";
import { hapticSuccess } from "@/lib/haptics";
import {
  removeSavingsAccount,
  unlinkSavingsAccount,
  updateSavingsAccount,
  type SavingsAccountView,
} from "@/lib/savings-accounts";
import { useFormatCurrency } from "@/providers/CurrencyProvider";
import { useLocale, useT } from "@/providers/LocaleProvider";
import { usePrivacy } from "@/providers/PrivacyProvider";
import { useToast } from "@/providers/ToastProvider";
import { TYPE } from "@/theme/tokens";

import { BankChoice } from "./AddAccountSheet";
import { formatRate } from "./format";

type Editing = "balance" | "rate" | "bank" | null;

/**
 * One savings account: what it holds, what it pays after tax, how full it
 * is, what goes in each month — and the few things to change about it.
 */
export function SavingsAccountCard({
  view,
  monthly,
  bankAccounts,
}: {
  view: SavingsAccountView;
  /** What the recurring entries put into it each month. */
  monthly: number;
  /** The bank accounts it could read its balance from. */
  bankAccounts: readonly BankAccount[];
}) {
  const t = useT();
  const locale = useLocale();
  const formatEuro = useFormatCurrency();
  const { hidden } = usePrivacy();
  const { toast } = useToast();
  const { account, balance, rate } = view;
  const preset = FRENCH_SAVINGS_2026[account.kind];
  const name = t(ENVELOPE_SHORT_KEYS[account.kind]);
  const fullName = t(ENVELOPE_NAME_KEYS[account.kind]);
  const linked = balance.source === "bank";
  const ownRate = account.kind === "pel" || account.kind === "livret";

  const [editing, setEditing] = useState<Editing>(null);
  const [draftBalance, setDraftBalance] = useState(balance.balance);
  const [draftRate, setDraftRate] = useState(rate);
  const [draftBank, setDraftBank] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const money = (value: number) => (hidden ? "••••••" : formatEuro(value));

  function open(next: Editing) {
    setError(null);
    setDraftBalance(balance.balance);
    setDraftRate(rate);
    setDraftBank(bankAccounts[0]?.provider_account_id ?? null);
    setEditing((current) => (current === next ? null : next));
  }

  async function run(
    action: () => Promise<{ error?: string }>,
    message: string,
  ) {
    setPending(true);
    setError(null);
    const result = await action();
    setPending(false);
    if (result.error) {
      setError(result.error);
      return false;
    }
    void hapticSuccess();
    toast(message);
    setEditing(null);
    return true;
  }

  const ceiling = preset.ceiling;
  const fill = ceiling ? Math.min(1, balance.balance / ceiling) : 0;

  return (
    <Card bezel innerClassName="gap-4 p-5">
      <View className="gap-0.5">
        <Text accessibilityRole="header" className="text-base font-semibold">
          {name}
        </Text>
        {fullName !== name ? (
          <Text variant="muted" className="text-xs">
            {fullName}
          </Text>
        ) : null}
      </View>

      <View className="gap-1">
        <AnimatedAmount
          value={balance.balance}
          format={formatEuro}
          style={[TYPE.hero, { fontSize: 34 }]}
          numberOfLines={1}
          adjustsFontSizeToFit
        />
        <Text variant="muted" className="text-sm">
          {linked
            ? t("accounts.balanceFromBank", {
                date: formatShortDate(balance.asOf, locale),
              })
            : t("accounts.balanceAsOf", {
                date: formatShortDate(balance.asOf, locale),
              })}
          {balance.added > 0
            ? ` · ${t("accounts.addedSince", { amount: money(balance.added) })}`
            : ""}
        </Text>
      </View>

      <View className="gap-1">
        <Text className="text-sm font-medium tabular-nums">
          {t("accounts.ratePerYear", { rate: formatRate(rate, locale) })}
          {" · "}
          {t("accounts.interestPerYear", {
            amount: money(yearlyInterest(balance.balance, account)),
          })}
        </Text>
        <Text variant="muted" className="text-xs">
          {t(SAVINGS_KIND_RATE_KEYS[account.kind])}
        </Text>
        <Text variant="muted" className="text-xs">
          {t(SAVINGS_KIND_TAX_KEYS[account.kind])}
        </Text>
      </View>

      {ceiling ? (
        <View className="gap-1.5">
          <View
            accessibilityRole="progressbar"
            accessibilityValue={{
              min: 0,
              max: 100,
              now: Math.round(fill * 100),
            }}
            className="h-1.5 overflow-hidden rounded-full bg-muted"
          >
            <View
              className="h-full rounded-full bg-foreground/60"
              style={{ width: `${fill * 100}%` }}
            />
          </View>
          <Text variant="muted" className="text-xs tabular-nums">
            {fill >= 1
              ? t("accounts.ceilingReached")
              : t("accounts.ceilingOf", {
                  balance: money(balance.balance),
                  ceiling: formatEuro(ceiling),
                })}
          </Text>
        </View>
      ) : null}

      <View className="gap-1">
        <Text className="text-sm">
          {monthly > 0
            ? t("accounts.monthlyPlanned", { amount: money(monthly) })
            : t("accounts.monthlyNone")}
        </Text>
        {view.categoryName && !linked ? (
          <Text variant="muted" className="text-xs">
            {t("accounts.categoryLine", { category: view.categoryName })}
          </Text>
        ) : null}
        {!preset.liquid ? (
          <Text variant="muted" className="text-xs">
            {t("accounts.notLiquid")}
          </Text>
        ) : null}
      </View>

      {editing === "balance" ? (
        <View className="gap-2">
          <View className="flex-row">
            <NumberField
              label={t("accounts.addBalance")}
              kind="money"
              value={draftBalance}
              onChange={setDraftBalance}
            />
          </View>
          <Button
            label={pending ? t("common.working") : t("accounts.save")}
            disabled={pending}
            onPress={() =>
              void run(
                () =>
                  updateSavingsAccount(account.id, { balance: draftBalance }),
                t("accounts.saved"),
              )
            }
          />
        </View>
      ) : null}

      {editing === "rate" ? (
        <View className="gap-2">
          <View className="flex-row">
            <NumberField
              label={t("accounts.addRate")}
              kind="percent"
              value={draftRate}
              max={0.2}
              onChange={setDraftRate}
            />
          </View>
          <Button
            label={pending ? t("common.working") : t("accounts.save")}
            disabled={pending}
            onPress={() =>
              void run(
                () =>
                  updateSavingsAccount(account.id, {
                    annualRate:
                      Math.abs(draftRate - preset.rate) > 1e-9
                        ? draftRate
                        : null,
                  }),
                t("accounts.saved"),
              )
            }
          />
        </View>
      ) : null}

      {editing === "bank" ? (
        <View className="gap-2">
          <BankChoice
            accounts={bankAccounts}
            value={draftBank}
            onChange={setDraftBank}
          />
          <Button
            label={pending ? t("common.working") : t("accounts.save")}
            disabled={pending || !draftBank}
            onPress={() =>
              void run(
                () =>
                  updateSavingsAccount(account.id, {
                    bankAccountId: draftBank,
                  }),
                t("accounts.saved"),
              )
            }
          />
        </View>
      ) : null}

      {error ? (
        <Text className="text-sm text-destructive">
          {resolveMessage(t, error)}
        </Text>
      ) : null}

      <View className="flex-row flex-wrap gap-2 border-t border-border pt-4">
        {!linked ? (
          <Button
            label={t("accounts.updateBalance")}
            variant="outline"
            size="sm"
            onPress={() => open("balance")}
          />
        ) : null}
        {ownRate ? (
          <Button
            label={t("accounts.editRate")}
            variant="outline"
            size="sm"
            onPress={() => open("rate")}
          />
        ) : null}
        {linked ? (
          <Button
            label={t("accounts.unlinkBank")}
            variant="outline"
            size="sm"
            disabled={pending}
            onPress={() =>
              void run(() => unlinkSavingsAccount(view), t("accounts.saved"))
            }
          />
        ) : bankAccounts.length > 0 ? (
          <Button
            label={t("accounts.linkBank")}
            variant="outline"
            size="sm"
            onPress={() => open("bank")}
          />
        ) : null}
        <Button
          label={t("accounts.remove")}
          variant="ghost"
          size="sm"
          onPress={() => setConfirming(true)}
        />
      </View>

      <ConfirmSheet
        open={confirming}
        title={t("accounts.removeSavingsConfirm", { name })}
        confirmLabel={t("accounts.remove")}
        pending={pending}
        onCancel={() => setConfirming(false)}
        onConfirm={() =>
          void run(
            () => removeSavingsAccount(account.id),
            t("accounts.removed", { name }),
          ).then(() => setConfirming(false))
        }
      />
    </Card>
  );
}

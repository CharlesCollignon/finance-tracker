import { useState } from "react";
import { View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { bankAttention } from "@finance/core/bank-attention";
import {
  awaitingRole,
  groupByBank,
  isFollowed,
  proposeForAccount,
} from "@finance/core/bank-accounts";
import { formatShortDate, todayIsoLocal } from "@finance/core/constants";
import { resolveMessage } from "@finance/core/i18n/t";
import { SAVINGS_KIND_SHORT_KEYS } from "@finance/core/savings-accounts";
import type {
  BankAccount,
  SavingsAccountKind,
} from "@finance/core/types/database";

import {
  AccountRoleEditor,
  type AccountChoice,
} from "@/components/bank/AccountRoleEditor";
import { PrivateAmount } from "@/components/PrivateAmount";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Text } from "@/components/ui/Text";
import { cn } from "@/lib/cn";
import { hapticLight } from "@/lib/haptics";
import { fileBankAccounts } from "@/lib/mutations";
import { useFormatCurrency } from "@/providers/CurrencyProvider";
import { useLocale, useT } from "@/providers/LocaleProvider";
import { useToast } from "@/providers/ToastProvider";
import { ICON } from "@/theme/tokens";
import { useThemeColors } from "@/theme/useThemeColors";

/** Which Livret reads which bank account, from Placements. */
export interface LivretLink {
  kind: SavingsAccountKind;
  bankAccountId: string | null;
}

/**
 * The accounts the user has already said something about, bank by bank —
 * the web's list. Each bank says how long it still shares; each account
 * says what it is, and changing that is one tap, saved at once. The
 * accounts no one has answered for yet are the new-accounts card's. The way
 * to add a bank sits at the bottom, where someone looking for a missing
 * account ends up.
 */
export function BankAccountsSection({
  accounts,
  livrets,
  onAddBank,
}: {
  accounts: BankAccount[];
  livrets: LivretLink[];
  onAddBank: (() => void) | null;
}) {
  const t = useT();
  const awaiting = new Set(
    awaitingRole(accounts).map((account) => account.provider_account_id),
  );
  const known = accounts.filter(
    (account) => !awaiting.has(account.provider_account_id),
  );
  if (known.length === 0) {
    return null;
  }

  return (
    <Card className="gap-4">
      <View className="gap-1">
        <Text className="text-base font-semibold">
          {t("bankAccounts.heading")}
        </Text>
        <Text variant="muted" className="text-sm">
          {t("bankAccounts.body")}
        </Text>
      </View>

      {groupByBank(known).map((group) => (
        <View key={group.bank ?? ""}>
          <BankHeading
            bank={group.bank}
            consentValidUntil={group.consentValidUntil}
            followed={group.accounts.some((account) =>
              isFollowed(account.role),
            )}
          />
          {group.accounts.map((account, index) => (
            <KnownAccountRow
              key={account.provider_account_id}
              account={account}
              last={index === group.accounts.length - 1}
              livret={
                livrets.find(
                  (link) => link.bankAccountId === account.provider_account_id,
                )?.kind ?? null
              }
            />
          ))}
        </View>
      ))}

      {onAddBank ? (
        <Button
          label={t("bankAccounts.addBank")}
          variant="outline"
          className="self-start"
          onPress={onAddBank}
        />
      ) : null}
    </Card>
  );
}

/**
 * A bank's name, and how long it still shares: the same window the renewal
 * reminder uses. Only a bank where an account is followed is asked to be
 * renewed; for the others an ended consent is not worth a line.
 */
export function BankHeading({
  bank,
  consentValidUntil,
  followed,
}: {
  bank: string | null;
  consentValidUntil: string | null;
  /** Whether an account here is Courant or Épargne. */
  followed: boolean;
}) {
  const t = useT();
  const locale = useLocale();
  const colors = useThemeColors();
  const attention = consentValidUntil
    ? bankAttention(
        { status: "active", consent_valid_until: consentValidUntil },
        todayIsoLocal(),
      )
    : null;
  const date = consentValidUntil
    ? formatShortDate(consentValidUntil.slice(0, 10), locale)
    : null;
  const renew = attention?.kind === "renew" ? attention : null;
  const ended = renew !== null && renew.daysLeft < 0;
  const warn = followed && renew !== null;

  return (
    <View className="gap-0.5 border-b border-border pb-2">
      <Text className="text-sm font-semibold">
        {bank ?? t("bankAccounts.otherBank")}
      </Text>
      {date && (followed || !ended) ? (
        <Text
          variant="muted"
          className={cn("text-xs", warn && "font-medium")}
          style={warn ? { color: colors.warning } : undefined}
        >
          {!warn
            ? t("bankAccounts.consentUntil", { date })
            : ended
              ? t("bankAccounts.consentEnded")
              : t("bankAccounts.consentSoon", { date })}
        </Text>
      ) : null}
    </View>
  );
}

/** What the bank calls an account, and the product when it says more. */
export function AccountName({ account }: { account: BankAccount }) {
  const t = useT();
  const colors = useThemeColors();
  const formatMoney = useFormatCurrency();
  const product =
    account.product &&
    account.product.trim().toLowerCase() !== account.label.trim().toLowerCase()
      ? account.product
      : null;
  return (
    <View className="flex-row items-start gap-3">
      <View className="min-w-0 flex-1 gap-0.5">
        <Text numberOfLines={1} className="text-sm font-medium">
          {account.label}
        </Text>
        {product ? (
          <Text variant="muted" numberOfLines={1} className="text-xs">
            {product}
          </Text>
        ) : null}
        {account.needs_reconnect ? (
          <View className="flex-row items-center gap-1">
            <Ionicons
              name="warning"
              size={ICON.xs}
              color={colors.destructive}
            />
            <Text className="text-xs text-destructive">
              {t("bearing.panel.cashAccountsLapsed")}
            </Text>
          </View>
        ) : null}
      </View>
      {account.reported_balance !== null && !account.needs_reconnect ? (
        <PrivateAmount className="text-sm">
          {formatMoney(Number(account.reported_balance))}
        </PrivateAmount>
      ) : null}
    </View>
  );
}

function KnownAccountRow({
  account,
  livret,
  last,
}: {
  account: BankAccount;
  /** The Livret that reads this account, if one does. */
  livret: SavingsAccountKind | null;
  last: boolean;
}) {
  const t = useT();
  const { toast } = useToast();
  // An account no one answered for whose consent lapsed is shown here, as
  // what it is in effect: not followed.
  const saved: AccountChoice = {
    role: account.role ?? "ignored",
    savingsKind: livret,
  };
  // What was just chosen, shown until the account read back says it.
  const [chosen, setChosen] = useState<AccountChoice | null>(null);
  if (
    chosen &&
    chosen.role === saved.role &&
    chosen.savingsKind === saved.savingsKind
  ) {
    setChosen(null);
  }
  const [pending, setPending] = useState(false);

  async function change(next: AccountChoice) {
    if (pending) {
      return;
    }
    // Becoming Épargne, it is the Livret its names say, unless one reads it.
    const savingsKind =
      next.role !== "savings"
        ? null
        : (next.savingsKind ?? proposeForAccount(account).savingsKind);
    void hapticLight();
    setChosen({ role: next.role, savingsKind });
    setPending(true);
    const result = await fileBankAccounts([
      {
        accountId: account.provider_account_id,
        role: next.role,
        savingsKind,
        livretName: savingsKind
          ? t(SAVINGS_KIND_SHORT_KEYS[savingsKind])
          : undefined,
      },
    ]);
    setPending(false);
    if (result.error !== undefined) {
      setChosen(null);
      toast(resolveMessage(t, result.error), "error");
    } else if (result.taken.length > 0) {
      setChosen(null);
      toast(
        t("bankAccounts.livretTaken", {
          count: result.taken.length,
          names: result.taken.join(", "),
        }),
      );
    }
  }

  return (
    <View
      className={cn("gap-2.5 py-3", !last && "border-b border-border")}
    >
      <AccountName account={account} />
      {/* Never answered for and unreadable: nothing to decide until it can
          be read again, when it is asked about with the new accounts. */}
      {account.role === null && account.needs_reconnect ? null : (
        <AccountRoleEditor
          account={account.label}
          value={chosen ?? saved}
          onChange={(next) => void change(next)}
          disabled={pending}
        />
      )}
    </View>
  );
}

import { useState } from "react";
import { View } from "react-native";

import { groupByBank, proposeForAccount } from "@finance/core/bank-accounts";
import { resolveMessage } from "@finance/core/i18n/t";
import { SAVINGS_KIND_SHORT_KEYS } from "@finance/core/savings-accounts";
import type { BankAccount } from "@finance/core/types/database";

import {
  AccountRoleEditor,
  type AccountChoice,
} from "@/components/bank/AccountRoleEditor";
import { AccountName, BankHeading } from "@/components/bank/BankAccountsSection";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Text } from "@/components/ui/Text";
import { cn } from "@/lib/cn";
import { hapticSuccess } from "@/lib/haptics";
import { fileBankAccounts } from "@/lib/mutations";
import { useT } from "@/providers/LocaleProvider";
import { useToast } from "@/providers/ToastProvider";
import { useThemeColors } from "@/theme/useThemeColors";

/**
 * The accounts nobody has said anything about yet — every account of a
 * first connection, or those of a bank added since — asked about together:
 * the web's card. Each arrives with the likeliest answer already chosen,
 * from what its bank says it is, and « C'est bon » files them all, making
 * the Livrets on Placements that do not exist yet. The Bank screen then
 * brings in the new current accounts' history on its own.
 */
export function NewAccountsCard({ accounts }: { accounts: BankAccount[] }) {
  const t = useT();
  const colors = useThemeColors();
  const { toast } = useToast();
  const [pending, setPending] = useState(false);
  // Only what the user changed; every other account shows its proposal, so
  // an account that turns up while the card is open is pre-filled too.
  const [changed, setChanged] = useState<Record<string, AccountChoice>>({});

  const choiceFor = (account: BankAccount): AccountChoice =>
    changed[account.provider_account_id] ?? proposeForAccount(account);

  async function confirm() {
    if (pending) {
      return;
    }
    setPending(true);
    const result = await fileBankAccounts(
      accounts.map((account) => {
        const choice = choiceFor(account);
        const savingsKind =
          choice.role === "savings" ? choice.savingsKind : null;
        return {
          accountId: account.provider_account_id,
          role: choice.role,
          savingsKind,
          livretName: savingsKind
            ? t(SAVINGS_KIND_SHORT_KEYS[savingsKind])
            : undefined,
        };
      }),
    );
    setPending(false);
    if (result.error !== undefined) {
      toast(resolveMessage(t, result.error), "error");
      return;
    }
    void hapticSuccess();
    toast(
      result.taken.length > 0
        ? t("bankAccounts.livretTaken", {
            count: result.taken.length,
            names: result.taken.join(", "),
          })
        : t("bankAccounts.confirmed"),
      result.taken.length > 0 ? "default" : "success",
    );
  }

  return (
    <Card className="gap-4" style={{ borderColor: colors.primaryRim }}>
      <View className="gap-1">
        <Text className="text-base font-semibold">
          {t("bankAccounts.newTitle", { count: accounts.length })}
        </Text>
        <Text variant="muted" className="text-sm">
          {t("bankAccounts.newBody")}
        </Text>
      </View>

      {groupByBank(accounts).map((group) => (
        <View key={group.bank ?? ""}>
          <BankHeading
            bank={group.bank}
            consentValidUntil={group.consentValidUntil}
            followed={false}
          />
          {group.accounts.map((account, index) => (
            <View
              key={account.provider_account_id}
              className={cn(
                "gap-2.5 py-3",
                index < group.accounts.length - 1 && "border-b border-border",
              )}
            >
              <AccountName account={account} />
              <AccountRoleEditor
                account={account.label}
                value={choiceFor(account)}
                disabled={pending}
                onChange={(next) =>
                  setChanged((current) => ({
                    ...current,
                    [account.provider_account_id]: next,
                  }))
                }
              />
            </View>
          ))}
        </View>
      ))}

      <Button
        label={pending ? t("common.working") : t("bankAccounts.confirm")}
        size="lg"
        disabled={pending}
        onPress={() => void confirm()}
      />
    </Card>
  );
}

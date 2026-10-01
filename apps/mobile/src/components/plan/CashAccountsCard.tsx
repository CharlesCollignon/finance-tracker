import { useState } from "react";
import { Pressable, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { formatShortDate } from "@finance/core/constants";
import type { BankAccount } from "@finance/core/types/database";

import { PrivateAmount } from "@/components/PrivateAmount";
import { PlanCard } from "@/components/plan/PlanCard";
import { Text } from "@/components/ui/Text";
import { cn } from "@/lib/cn";
import { hapticLight } from "@/lib/haptics";
import { setAccountCountsAsCash } from "@/lib/plan-data";
import { useFormatCurrency } from "@/providers/CurrencyProvider";
import { useLocale, useT } from "@/providers/LocaleProvider";
import { useToast } from "@/providers/ToastProvider";
import { ICON } from "@/theme/tokens";
import { useThemeColors } from "@/theme/useThemeColors";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Which connected accounts hold money the user spends — the web's
 * `CashAccountsCard`, which opens the footer of its Plan page.
 *
 * A connection is not one account, and one with lapsed consents reports
 * balances of zero: counting every account it could see would invent a month
 * in which thousands vanished. Nothing counts until it is ticked here. Absent
 * for anyone with no connected bank, like the web's.
 */
export function CashAccountsCard({
  accounts,
  onChanged,
}: {
  accounts: BankAccount[];
  onChanged: () => void;
}) {
  const t = useT();
  const locale = useLocale();
  const { toast } = useToast();
  const formatMoney = useFormatCurrency();
  const colors = useThemeColors();
  const [pending, setPending] = useState(false);

  if (accounts.length === 0) {
    return null;
  }

  const counted = accounts.filter((account) => account.counts_as_cash).length;

  async function toggle(account: BankAccount) {
    if (pending) {
      return;
    }
    void hapticLight();
    setPending(true);
    const result = await setAccountCountsAsCash(
      account.provider_account_id,
      !account.counts_as_cash,
    );
    setPending(false);
    if (result.error) {
      toast(result.error, "error");
      return;
    }
    onChanged();
  }

  return (
    <PlanCard>
      <View className="gap-1">
        <Text accessibilityRole="header" className="text-sm font-medium">
          {t("bearing.panel.cashAccountsHeading")}
        </Text>
        <Text variant="muted" className="text-sm">
          {`${t("bearing.panel.cashAccountsBody")} ${t("cashAccounts.tickHint")}`}
        </Text>
      </View>

      <View>
        {accounts.map((account, index) => {
          const unreadable = account.needs_reconnect;
          const checked = account.counts_as_cash;
          return (
            <Pressable
              key={account.provider_account_id}
              accessibilityRole="checkbox"
              accessibilityState={{ checked, disabled: pending }}
              accessibilityLabel={account.label}
              disabled={pending}
              onPress={() => void toggle(account)}
              className={cn(
                "min-h-14 flex-row items-center gap-3 py-3",
                index > 0 && "border-t border-border",
                pending && "opacity-60",
              )}
            >
              {/* The foreground, not gold: ticking an account is a setting,
                  not the one decision this screen is asking for. */}
              <View
                className={cn(
                  "h-5 w-5 items-center justify-center rounded-control border",
                  checked
                    ? "border-foreground bg-foreground"
                    : "border-hairline-strong",
                )}
              >
                {checked ? (
                  <Ionicons
                    name="checkmark"
                    size={ICON.sm}
                    color={colors.background}
                  />
                ) : null}
              </View>
              <View className="min-w-0 flex-1">
                <Text numberOfLines={1} className="text-sm font-medium">
                  {account.label}
                </Text>
                {unreadable ? (
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
                ) : account.reported_on ? (
                  <Text variant="muted" className="text-xs">
                    {t("cashAccounts.lastRead", {
                      when: ISO_DATE.test(account.reported_on)
                        ? formatShortDate(account.reported_on, locale)
                        : account.reported_on,
                    })}
                  </Text>
                ) : null}
              </View>
              {account.reported_balance !== null && !unreadable ? (
                <PrivateAmount className="text-sm">
                  {formatMoney(Number(account.reported_balance))}
                </PrivateAmount>
              ) : null}
            </Pressable>
          );
        })}
      </View>

      <View className="flex-row items-start gap-1.5">
        <Ionicons
          name="refresh"
          size={ICON.sm}
          color={colors.mutedForeground}
          style={{ marginTop: 1 }}
        />
        <Text variant="muted" className="min-w-0 flex-1 text-xs">
          {counted === 0
            ? t("cashAccounts.noneTicked")
            : t("cashAccounts.autoCloses")}
        </Text>
      </View>
    </PlanCard>
  );
}

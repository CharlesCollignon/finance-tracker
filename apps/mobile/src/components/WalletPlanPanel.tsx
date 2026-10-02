import { useMemo, useState } from "react";
import { Pressable, View } from "react-native";

import {
  buildAllocation,
  formatWeight,
  isSavingsAccountId,
  suggestContributionSplit,
  type AccountId,
  type AccountTarget,
} from "@finance/core/allocation";
import { ENVELOPE_SHORT_KEYS } from "@finance/core/future-plan";
import type { InvestmentPortfolioSummary } from "@finance/core/investment-positions";
import type { InvestmentReturns } from "@finance/core/investment-returns";
import { FRENCH_SAVINGS_2026 } from "@finance/core/savings-accounts";
import { formatAnnualRate } from "@finance/core/xirr";
import type { WalletPlan } from "@finance/core/types/database";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { PrivateAmount } from "@/components/PrivateAmount";
import { Text } from "@/components/ui/Text";
import { cn } from "@/lib/cn";
import { saveAccountTargets } from "@/lib/mutations";
import type { SavingsAccountView } from "@/lib/savings-accounts";
import { useFormatCurrency } from "@/providers/CurrencyProvider";
import { useToast } from "@/providers/ToastProvider";
import { useThemeColors } from "@/theme/useThemeColors";
import { useLocale, useT } from "@/providers/LocaleProvider";
import { RADIUS } from "@/theme/tokens";
import { resolveMessage } from "@finance/core/i18n/t";

interface WalletPlanPanelProps {
  /** The wallets kept, and only them. */
  portfolio: InvestmentPortfolioSummary;
  /** The savings accounts declared. */
  savings: readonly SavingsAccountView[];
  returns: InvestmentReturns | null;
  plans: WalletPlan[];
  /** Typical monthly contribution, so the split is in real money. */
  monthlyContribution: number;
}

/**
 * The part of Placements that says what to do, rather than what is.
 *
 * Mirrors the web panel: how far the split across every account kept — the
 * savings accounts beside the wallets — has drifted from what the user
 * intended, where the next contribution should go to close the gap without
 * selling anything. The PEA's ceiling and five-year clock are about that one
 * account, so they sit under it on the accounts view (`PeaCard`).
 */
export function WalletPlanPanel({
  portfolio,
  savings,
  returns,
  plans,
  monthlyContribution,
}: WalletPlanPanelProps) {
  const t = useT();
  const locale = useLocale();
  const formatEuro = useFormatCurrency();
  const colors = useThemeColors();
  const [editing, setEditing] = useState(false);

  const planByWallet = useMemo(
    () => new Map(plans.map((plan) => [plan.wallet, plan])),
    [plans],
  );

  const accounts: AccountId[] = useMemo(
    () => [
      ...savings.map((view) => view.account.kind),
      ...portfolio.columns.map((column) => column.walletId),
    ],
    [savings, portfolio.columns],
  );

  const targets: AccountTarget[] = useMemo(
    () => [
      ...savings.map((view) => ({
        accountId: view.account.kind as AccountId,
        targetWeight:
          view.account.target_weight === null ||
          view.account.target_weight === undefined
            ? null
            : Number(view.account.target_weight),
      })),
      ...portfolio.columns.map((column) => {
        const weight = planByWallet.get(column.walletId)?.target_weight;
        return {
          accountId: column.walletId as AccountId,
          targetWeight:
            weight === null || weight === undefined ? null : Number(weight),
        };
      }),
    ],
    [savings, portfolio.columns, planByWallet],
  );

  const allocation = useMemo(
    () =>
      buildAllocation(
        [
          ...savings.map((view) => ({
            accountId: view.account.kind as AccountId,
            value: view.balance.balance,
          })),
          ...portfolio.columns.map((column) => ({
            accountId: column.walletId as AccountId,
            value: column.totalMarketValue,
          })),
        ],
        targets,
        accounts,
      ),
    [savings, portfolio.columns, targets, accounts],
  );

  const split = useMemo(
    () => suggestContributionSplit(allocation, monthlyContribution),
    [allocation, monthlyContribution],
  );

  const returnByWallet = useMemo(
    () => new Map((returns?.wallets ?? []).map((row) => [row.walletId, row])),
    [returns],
  );

  // A wallet's return is measured; a savings account's is its rate, net of
  // the tax on its interest.
  function rateOf(id: AccountId): number | null {
    if (isSavingsAccountId(id)) {
      const view = savings.find((entry) => entry.account.kind === id);
      return view
        ? view.rate * (1 - FRENCH_SAVINGS_2026[id].taxOnInterest)
        : null;
    }
    return returnByWallet.get(id)?.rate ?? null;
  }

  return (
    <Card bezel innerClassName="gap-3 p-5">
      <View className="flex-row items-center justify-between">
        <Text className="font-bold">{t("position.allocation")}</Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => setEditing((value) => !value)}
          hitSlop={8}
        >
          <Text className="text-sm font-medium text-primary-ink">
            {editing ? t("position.cancel") : t("position.setTargets")}
          </Text>
        </Pressable>
      </View>

      {editing ? (
        <TargetEditor
          initial={targets}
          onSaved={() => setEditing(false)}
        />
      ) : (
        <View className="gap-3">
          {allocation.rows.map((row) => {
            const rate = formatAnnualRate(rateOf(row.accountId), locale);

            return (
              <View key={row.accountId} className="gap-1.5">
                <View className="flex-row items-baseline justify-between gap-3">
                  <Text className="text-sm font-medium">
                    {t(ENVELOPE_SHORT_KEYS[row.accountId])}
                  </Text>
                  <PrivateAmount className="font-sans tabular-nums text-sm">
                    {formatEuro(row.value)}
                  </PrivateAmount>
                </View>

                <View
                  className="h-2 w-full overflow-hidden rounded-full"
                  style={{ backgroundColor: colors.muted }}
                >
                  <View
                    style={{
                      height: "100%",
                      borderRadius: RADIUS.pill,
                      backgroundColor: colors.primary,
                      width: `${Math.round(row.currentWeight * 100)}%`,
                    }}
                  />
                </View>

                <View className="flex-row flex-wrap items-center justify-between gap-x-3">
                  <Text variant="muted" className="text-xs">
                    {row.targetWeight !== null
                      ? t("position.shareNowTarget", {
                          share: formatWeight(row.currentWeight, locale),
                          target: formatWeight(row.targetWeight, locale),
                        })
                      : formatWeight(row.currentWeight, locale)}
                    {rate ? ` · ${rate}` : ""}
                  </Text>
                  {row.status === "over" || row.status === "under" ? (
                    <Text
                      className={cn(
                        "text-xs",
                        row.status === "over"
                          ? "text-destructive"
                          : "text-muted-foreground",
                      )}
                    >
                      {t(
                        row.status === "over"
                          ? "position.pointsAbove"
                          : "position.pointsBelow",
                        { count: Math.abs(Math.round(row.driftPoints ?? 0)) },
                      )}
                    </Text>
                  ) : null}
                </View>
              </View>
            );
          })}
        </View>
      )}

      {!editing && allocation.needsRebalance && split.length > 0 ? (
        <View className="border-t border-border pt-3">
          <Text variant="muted" className="text-sm">
            {`${t("position.nextContributionBefore")} `}
            <PrivateAmount className="text-sm text-foreground">
              {formatEuro(monthlyContribution)}
            </PrivateAmount>
            {` ${t("position.nextContributionAfter")} `}
            {split.map((row, index) => (
              <Text key={row.accountId} className="text-sm">
                {index > 0 ? ", " : ""}
                <PrivateAmount className="text-sm font-semibold text-foreground">
                  {formatEuro(row.amount)}
                </PrivateAmount>
                {` ${t("position.splitItemTo", {
                  wallet: t(ENVELOPE_SHORT_KEYS[row.accountId]),
                })}`}
              </Text>
            ))}
          </Text>
        </View>
      ) : null}

      {!editing && allocation.targetCoverage === 0 ? (
        <Text variant="muted" className="border-t border-border pt-3 text-sm">
          {t("position.noTargetHint")}
        </Text>
      ) : null}
    </Card>
  );
}

function TargetEditor({
  initial,
  onSaved,
}: {
  initial: AccountTarget[];
  onSaved: () => void;
}) {
  const t = useT();
  const { toast } = useToast();
  const [pending, setPending] = useState(false);
  const [draft, setDraft] = useState(() =>
    initial.map((target) => ({
      accountId: target.accountId,
      percent: String(Math.round((target.targetWeight ?? 0) * 100)),
    })),
  );

  const total = draft.reduce((sum, row) => sum + (Number(row.percent) || 0), 0);

  async function save() {
    setPending(true);
    const result = await saveAccountTargets(
      draft.map((row) => ({
        accountId: row.accountId,
        targetWeight: (Number(row.percent) || 0) / 100,
      })),
    );
    setPending(false);

    if (result.error) {
      toast(resolveMessage(t, result.error), "error");
      return;
    }
    toast(t("position.targetsSaved"), "success");
    onSaved();
  }

  return (
    <View className="gap-3">
      {draft.map((row) => (
        <View
          key={row.accountId}
          className="flex-row items-center justify-between gap-3"
        >
          <Text className="text-sm">
            {t(ENVELOPE_SHORT_KEYS[row.accountId])}
          </Text>
          <View className="w-24 flex-row items-center gap-2">
            <Input
              value={row.percent}
              onChangeText={(value) =>
                setDraft((current) =>
                  current.map((item) =>
                    item.accountId === row.accountId
                      ? { ...item, percent: value.replace(/[^0-9]/g, "") }
                      : item,
                  ),
                )
              }
              keyboardType="number-pad"
              accessibilityLabel={t("position.targetPercentFor", {
                wallet: t(ENVELOPE_SHORT_KEYS[row.accountId]),
              })}
              className="flex-1 text-right"
            />
            <Text variant="muted" className="text-sm">
              %
            </Text>
          </View>
        </View>
      ))}

      <Text
        className={cn(
          "font-sans tabular-nums text-sm",
          total === 100 ? "text-muted-foreground" : "text-destructive",
        )}
      >
        {total === 100
          ? t("position.targetTotalComplete")
          : total < 100
            ? t("position.targetTotalShort", { left: 100 - total })
            : t("position.targetTotalOver", { over: total - 100 })}
      </Text>

      <Button
        label={pending ? t("position.saving") : t("position.saveTargets")}
        disabled={pending || total !== 100}
        onPress={() => void save()}
      />
    </View>
  );
}

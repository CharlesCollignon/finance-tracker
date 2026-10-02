import { RefreshControl, ScrollView, View } from "react-native";
import { useRouter } from "expo-router";

import type { AccountId } from "@finance/core/allocation";
import { ENVELOPE_SHORT_KEYS } from "@finance/core/future-plan";
import { returnUnavailableLabel } from "@finance/core/investment-returns";
import { FRENCH_SAVINGS_2026 } from "@finance/core/savings-accounts";
import { formatAnnualRate } from "@finance/core/xirr";
import { resolveMessage } from "@finance/core/i18n/t";

import { formatRate } from "@/components/accounts/format";
import { FundCostCard } from "@/components/FundCostCard";
import { SurfaceTabs, WALLET_TABS } from "@/components/layout/SurfaceTabs";
import { WalletPlanPanel } from "@/components/WalletPlanPanel";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Screen } from "@/components/ui/Screen";
import { ScreenSkeleton } from "@/components/ui/Skeleton";
import { Text } from "@/components/ui/Text";
import { useRefreshable } from "@/hooks/useRefreshable";
import { cn } from "@/lib/cn";
import { getPlacementsData, keptAccounts } from "@/lib/placements-data";
import { useAuth } from "@/providers/AuthProvider";
import { useLocale, useT } from "@/providers/LocaleProvider";
import { useTabBarClearance } from "@/theme/chrome";

/**
 * Placements' Analyse view: what each account earns a year, how the money is
 * spread across them, and what holding it costs — the cards that used to
 * trail under the accounts, given a view of their own so the accounts stay
 * the accounts.
 *
 * A savings account is part of each: it earns its rate (net of the tax on
 * its interest), it is a share of the split, and it costs nothing to hold.
 */
export default function AnalysisScreen() {
  const t = useT();
  const locale = useLocale();
  const router = useRouter();
  const { user } = useAuth();
  const tabBarClearance = useTabBarClearance();

  const { data, loading, refreshing, onRefreshAll, error } =
    useRefreshable(
      async () => (user ? getPlacementsData(user.id, locale) : null),
      [user?.id, locale],
    );

  const kept = data ? keptAccounts(data) : null;
  const savings = data?.savings.accounts ?? [];
  const wallets = kept?.wallets ?? [];
  const hasAccounts = savings.length > 0 || wallets.length > 0;
  const returns = data?.returns ?? null;
  const returnByWallet = new Map(
    (returns?.wallets ?? []).map((row) => [row.walletId, row]),
  );

  // What goes in each month, wallets and savings accounts alike, so the
  // split's suggestion is in real money.
  const monthlyContribution =
    (data?.fundingNeeds ?? []).reduce(
      (sum, need) => sum + need.monthlyTotal,
      0,
    ) +
    savings.reduce(
      (sum, view) => sum + (kept?.savingsMonthly[view.account.kind] ?? 0),
      0,
    );

  const rows: { id: AccountId; value: string; tone: number | null }[] = [
    ...savings.map((view) => {
      const net =
        view.rate * (1 - FRENCH_SAVINGS_2026[view.account.kind].taxOnInterest);
      return {
        id: view.account.kind as AccountId,
        value: t("accounts.returnSavings", { rate: formatRate(net, locale) }),
        tone: net,
      };
    }),
    ...wallets.map((wallet) => {
      const entry = returnByWallet.get(wallet);
      return {
        id: wallet as AccountId,
        value:
          formatAnnualRate(entry?.rate ?? null, locale) ??
          returnUnavailableLabel(entry?.unavailableReason ?? null, locale) ??
          "—",
        tone: entry?.rate ?? null,
      };
    }),
  ];

  return (
    <Screen title={t("nav.wallets")} className="pb-0">
      <SurfaceTabs tabs={WALLET_TABS} className="mb-3" />
      {loading && !data ? (
        <ScreenSkeleton rows={4} />
      ) : error ? (
        <Text className="text-destructive">{resolveMessage(t, error)}</Text>
      ) : !hasAccounts ? (
        <View className="gap-3 pt-2">
          <EmptyState
            title={t("accounts.emptyTitle")}
            description={t("accounts.emptyBody")}
          />
          <Button
            label={t("accounts.add")}
            size="lg"
            onPress={() => router.replace("/investments")}
          />
        </View>
      ) : (
        <ScrollView
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefreshAll} />
          }
          contentContainerClassName="gap-5 pt-2"
          contentContainerStyle={{ paddingBottom: tabBarClearance }}
          showsVerticalScrollIndicator={false}
        >
          <Text variant="muted" className="text-sm">
            {t("accounts.analysisIntro")}
          </Text>

          {/* What each account earns a year: measured for a wallet, its rate
              for a savings account. */}
          <Card bezel innerClassName="gap-3 p-5">
            <View className="flex-row items-baseline justify-between gap-3">
              <Text className="font-bold">{t("wallets.returnTitle")}</Text>
              {returns && wallets.length > 0 ? (
                <Text
                  className={cn(
                    "font-sans tabular-nums font-bold",
                    returns.total.rate === null
                      ? "text-muted-foreground"
                      : returns.total.rate >= 0
                        ? "text-success"
                        : "text-destructive",
                  )}
                  style={{ fontSize: 18 }}
                >
                  {formatAnnualRate(returns.total.rate, locale) ??
                    returnUnavailableLabel(
                      returns.total.unavailableReason,
                      locale,
                    )}
                </Text>
              ) : null}
            </View>
            <View className="gap-2">
              {rows.map((row) => (
                <View
                  key={row.id}
                  className="flex-row items-baseline justify-between gap-3"
                >
                  <Text className="text-sm">
                    {t(ENVELOPE_SHORT_KEYS[row.id])}
                  </Text>
                  <Text
                    className={cn(
                      "font-sans tabular-nums text-sm",
                      row.tone === null
                        ? "text-muted-foreground"
                        : row.tone < 0
                          ? "text-destructive"
                          : "text-foreground",
                    )}
                  >
                    {row.value}
                  </Text>
                </View>
              ))}
            </View>
            <View className="gap-1 border-t border-border pt-3">
              {wallets.length > 0 ? (
                <Text variant="muted" className="text-xs">
                  {t("wallets.returnBody")}
                </Text>
              ) : null}
              {savings.length > 0 ? (
                <Text variant="muted" className="text-xs">
                  {t("accounts.returnSavingsHint")}
                </Text>
              ) : null}
            </View>
          </Card>

          {data && kept ? (
            <WalletPlanPanel
              portfolio={kept.keptPortfolio}
              savings={savings}
              returns={returns}
              plans={data.plans}
              monthlyContribution={monthlyContribution}
            />
          ) : null}

          {/* Fees last: a figure worth checking once a year, not on every
              visit. A savings account costs nothing to hold, and says so. */}
          {kept && wallets.length > 0 ? (
            <FundCostCard portfolio={kept.keptPortfolio} />
          ) : null}
          {savings.length > 0 ? (
            <Card bezel innerClassName="gap-2 p-5">
              {wallets.length === 0 ? (
                <Text className="font-bold">{t("fundCost.title")}</Text>
              ) : null}
              {savings.map((view) => (
                <View
                  key={view.account.id}
                  className="flex-row items-baseline justify-between gap-3"
                >
                  <Text className="text-sm">
                    {t(ENVELOPE_SHORT_KEYS[view.account.kind])}
                  </Text>
                  <Text variant="muted" className="text-sm">
                    {t("accounts.feesNone")}
                  </Text>
                </View>
              ))}
            </Card>
          ) : null}
        </ScrollView>
      )}
    </Screen>
  );
}

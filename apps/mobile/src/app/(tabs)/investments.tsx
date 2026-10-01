import { useState } from "react";
import { RefreshControl, ScrollView, View } from "react-native";

import { getCurrentMonth, todayIsoLocal } from "@finance/core/constants";
import {
  buildInvestmentReturns,
  returnUnavailableLabel,
} from "@finance/core/investment-returns";
import { formatAnnualRate } from "@finance/core/xirr";
import {
  INVESTMENT_WALLET_IDS,
  INVESTMENT_WALLET_LABELS,
  INVESTMENT_WALLET_NAME_KEYS,
  type InvestmentWalletId,
} from "@finance/core/investments";
import {
  buildUpcomingInvestments,
  buildWalletFundingNeeds,
  nextUpcomingByWallet,
  sumUpcomingAmount,
  type WalletFundingNeed,
} from "@finance/core/investment-upcoming";
import type {
  InvestmentPortfolioSummary,
  InvestmentPositionItem,
} from "@finance/core/investment-positions";
import type {
  RecurringTemplateWithCategory,
  TransactionWithCategory,
  WalletPlan,
} from "@finance/core/types/database";

import { InvestmentPositionRow } from "@/components/InvestmentPositionRow";
import { WalletPerformance } from "@/components/WalletPerformance";
import { InvestmentPositionSheet } from "@/components/InvestmentPositionSheet";
import { Card } from "@/components/ui/Card";
import { ChipRow } from "@/components/ui/ChipRow";
import { EmptyState } from "@/components/ui/EmptyState";
import { PrivateAmount } from "@/components/PrivateAmount";
import { Screen } from "@/components/ui/Screen";
import { ScreenSkeleton } from "@/components/ui/Skeleton";
import { FundCostCard } from "@/components/FundCostCard";
import { StatHero } from "@/components/StatHero";
import { WalletPlanPanel } from "@/components/WalletPlanPanel";
import { Text } from "@/components/ui/Text";
import { useRefreshable } from "@/hooks/useRefreshable";
import { cn } from "@/lib/cn";
import { useDataVersion } from "@/lib/data-version";
import { useAuth } from "@/providers/AuthProvider";
import { useFormatCurrency } from "@/providers/CurrencyProvider";
import { useTabBarClearance } from "@/theme/chrome";
import { SurfaceTabs, WALLET_TABS } from "@/components/layout/SurfaceTabs";
import {
  getInvestmentTransactions,
  getRecurringTemplates,
  getWalletPortfolio,
  getWalletPlans,
} from "@/lib/queries";
import { useLocale, useT } from "@/providers/LocaleProvider";
import { resolveMessage } from "@finance/core/i18n/t";

export default function InvestmentsScreen() {
  const t = useT();
  const locale = useLocale();
  const tabBarClearance = useTabBarClearance();
  const { user } = useAuth();
  const formatEuro = useFormatCurrency();
  const current = getCurrentMonth();
  const [activeWallet, setActiveWallet] = useState<InvestmentWalletId>("pea");
  const [editingPosition, setEditingPosition] =
    useState<InvestmentPositionItem | null>(null);

  const dataVersion = useDataVersion();
  const { data, loading, refreshing, onRefresh, onRefreshAll, error } =
    useRefreshable(async () => {
      if (!user) {
        return {
          portfolio: null as InvestmentPortfolioSummary | null,
          upcoming: [] as ReturnType<typeof buildUpcomingInvestments>,
          fundingNeeds: [] as WalletFundingNeed[],
          returns: null as ReturnType<typeof buildInvestmentReturns> | null,
          plans: [] as WalletPlan[],
        };
      }
      const [portfolio, templates, transactions, plans] = await Promise.all([
        // History powers the per-position charts.
        getWalletPortfolio(user.id, locale, { includeHistory: true }),
        getRecurringTemplates(user.id),
        getInvestmentTransactions(user.id),
        getWalletPlans(user.id),
      ]);
      const investmentTemplates = (
        templates as RecurringTemplateWithCategory[]
      ).filter((template) => template.categories.type === "investment");
      const upcoming = buildUpcomingInvestments(
        investmentTemplates,
        transactions as TransactionWithCategory[],
        todayIsoLocal(),
        locale,
      );
      const fundingNeeds = buildWalletFundingNeeds(
        investmentTemplates,
        current.year,
        current.month,
      );
      const returns = buildInvestmentReturns(
        transactions as TransactionWithCategory[],
        portfolio,
        todayIsoLocal(),
      );
      return { portfolio, upcoming, fundingNeeds, returns, plans };
    }, [user?.id, current.year, current.month, dataVersion]);

  const portfolio = data?.portfolio;
  const returns = data?.returns ?? null;
  const plans = data?.plans ?? [];
  const upcoming = data?.upcoming ?? [];
  const nextByWallet = nextUpcomingByWallet(upcoming);
  const fundingNeeds = (data?.fundingNeeds ?? []).filter(
    (need) => need.monthlyTotal > 0,
  );
  const activeItems =
    portfolio?.columns.find((entry) => entry.walletId === activeWallet)
      ?.items ?? [];
  const hasData =
    portfolio &&
    portfolio.columns.some(
      (column) => column.items.length > 0 || column.totalInvested > 0,
    );

  const walletOptions = INVESTMENT_WALLET_IDS.map((id) => ({
    value: id,
    label: INVESTMENT_WALLET_LABELS[id],
  }));

  return (
    <Screen title={t("nav.wallets")} className="pb-0">
      {/* Positions and what they are made of, as the web's strip. */}
      <SurfaceTabs tabs={WALLET_TABS} className="mb-3" />
      {loading && !portfolio ? (
        <ScreenSkeleton rows={3} />
      ) : error ? (
        <Text className="text-destructive">{resolveMessage(t, error)}</Text>
      ) : !portfolio ? (
        <EmptyState
          title={t("wallets.emptyTitleMobile")}
          description={t("wallets.emptyBodyMobile")}
        />
      ) : (
        /*
         * In the web's order: what it is all worth, what goes in each month,
         * then one account and what it holds. The positions used to come
         * eighth, under the return, the fees, the plan, one card per
         * account to fund and the performance chart; the reasons to open
         * this screen were the last thing on it.
         */
        <ScrollView
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefreshAll} />
          }
          contentContainerClassName="gap-5 pt-2"
          contentContainerStyle={{ paddingBottom: tabBarClearance }}
        >
          <StatHero
            label={t("wallets.marketValue")}
            amount={formatEuro(portfolio.totalMarketValue)}
            animateValue={portfolio.totalMarketValue}
            format={formatEuro}
            subtitle={
              <>
                <PrivateAmount className="text-sm text-muted-foreground">
                  {formatEuro(portfolio.totalInvested)}
                </PrivateAmount>
                {` ${t("wallets.investedSuffix")}`}
                {portfolio.hasMarketSnapshot &&
                portfolio.totalGainLoss !== 0 ? (
                  <>
                    {" · "}
                    <PrivateAmount
                      className={cn(
                        "text-sm font-medium",
                        portfolio.totalGainLoss > 0
                          ? "text-success"
                          : "text-destructive",
                      )}
                    >
                      {formatSigned(portfolio.totalGainLoss, formatEuro)}
                    </PrivateAmount>
                  </>
                ) : null}
              </>
            }
          />

          {/* One row of tags rather than one card per account: three cards
              of "Send to X €Y / month" were three cards of height for three
              numbers, and the account's name is label enough. */}
          {fundingNeeds.length > 0 || upcoming.length > 0 ? (
            <View className="items-center gap-2">
              {fundingNeeds.length > 0 ? (
                <View
                  accessibilityLabel={t("wallets.fundingLabel")}
                  className="flex-row flex-wrap justify-center gap-2"
                >
                  {fundingNeeds.map((need) => (
                    <View
                      key={need.walletId}
                      className="flex-row items-baseline gap-1.5 rounded-full border border-border px-3 py-1"
                    >
                      <Text variant="muted" className="text-xs">
                        {INVESTMENT_WALLET_LABELS[need.walletId]}
                      </Text>
                      <PrivateAmount className="text-xs font-medium">
                        {formatEuro(need.monthlyTotal)}
                      </PrivateAmount>
                      <Text variant="muted" className="text-xs">
                        {t("wallets.perMonth")}
                      </Text>
                    </View>
                  ))}
                </View>
              ) : null}
              {upcoming.length > 0 ? (
                <Text variant="muted" className="text-center text-xs">
                  {t("wallets.upcomingThisMonth", {
                    amount: formatEuro(sumUpcomingAmount(upcoming)),
                  })}
                </Text>
              ) : null}
            </View>
          ) : null}

          {!hasData ? (
            <EmptyState
              title={t("wallets.trackTitle")}
              description={t("wallets.trackBody")}
            />
          ) : null}

          <View className="gap-2">
            <ChipRow
              label={t("wallets.walletPicker")}
              options={walletOptions}
              value={activeWallet}
              onChange={setActiveWallet}
            />
            {/* The acronym spelled out, once, under the chip that uses it. */}
            <Text variant="muted" className="px-1 text-xs">
              {t(INVESTMENT_WALLET_NAME_KEYS[activeWallet])}
            </Text>
          </View>

          <View>
            <Text className="mb-2 text-base font-medium">
              {t("wallets.inWallet", {
                wallet: INVESTMENT_WALLET_LABELS[activeWallet],
              })}
            </Text>
            <Card bezel innerClassName="px-4 py-1">
              {activeItems.length === 0 ? (
                <Text variant="muted" className="py-4 text-sm">
                  {t("wallets.noItems")}
                </Text>
              ) : (
                activeItems.map((item, index) => (
                  <View
                    key={item.id}
                    className={index > 0 ? "border-t border-border" : ""}
                  >
                    <InvestmentPositionRow
                      item={item}
                      onEdit={() => setEditingPosition(item)}
                    />
                  </View>
                ))
              )}
            </Card>
          </View>

          <WalletPerformance
            portfolio={portfolio}
            activeWallet={activeWallet}
            nextByWallet={nextByWallet}
          />

          {returns ? (
            <Card bezel innerClassName="p-5">
              <View className="flex-row items-baseline justify-between gap-3">
                <Text variant="muted" className="text-sm">
                  {t("wallets.returnTitle")}
                </Text>
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
              </View>
              <Text variant="muted" className="mt-2 text-xs">
                {t("wallets.returnBody")}
              </Text>
            </Card>
          ) : null}

          <WalletPlanPanel
            portfolio={portfolio}
            returns={returns}
            plans={plans}
            monthlyContribution={fundingNeeds.reduce(
              (sum, need) => sum + need.monthlyTotal,
              0,
            )}
            onSaved={onRefresh}
          />

          {/* Fees last: a figure worth checking once a year, not on every
              visit. */}
          <FundCostCard portfolio={portfolio} />
        </ScrollView>
      )}

      <InvestmentPositionSheet
        item={editingPosition}
        onClose={() => setEditingPosition(null)}
        onSaved={onRefresh}
      />
    </Screen>
  );
}

function formatSigned(amount: number, format: (v: number) => string): string {
  const formatted = format(Math.abs(amount));
  if (amount > 0) return `+${formatted}`;
  if (amount < 0) return `−${formatted}`;
  return formatted;
}

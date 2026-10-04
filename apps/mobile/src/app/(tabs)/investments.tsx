import { useState } from "react";
import { RefreshControl, ScrollView, View } from "react-native";

import { ENVELOPE_SHORT_KEYS } from "@finance/core/future-plan";
import {
  INVESTMENT_WALLET_IDS,
  INVESTMENT_WALLET_NAME_KEYS,
  type InvestmentWalletId,
} from "@finance/core/investments";
import { todayIsoLocal } from "@finance/core/constants";
import { nextUpcomingByWallet } from "@finance/core/investment-upcoming";
import { fetchPriceSeriesBySymbol } from "@finance/core/market/fx";
import type { InstrumentPriceSeries } from "@finance/core/instrument-price-series";
import type { InvestmentPositionItem } from "@finance/core/investment-positions";
import type { SavingsAccountKind } from "@finance/core/types/database";

import {
  AddAccountSheet,
  type AccountKey,
} from "@/components/accounts/AddAccountSheet";
import { NewPositionSheet } from "@/components/accounts/NewPositionSheet";
import { PeaCard } from "@/components/PeaCard";
import { SavingsAccountCard } from "@/components/accounts/SavingsAccountCard";
import { InvestmentPositionRow } from "@/components/InvestmentPositionRow";
import { InvestmentPositionSheet } from "@/components/InvestmentPositionSheet";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ChipRow } from "@/components/ui/ChipRow";
import { ConfirmSheet } from "@/components/ui/ConfirmSheet";
import { EmptyState } from "@/components/ui/EmptyState";
import { PrivateAmount } from "@/components/PrivateAmount";
import { Screen } from "@/components/ui/Screen";
import { ScreenSkeleton } from "@/components/ui/Skeleton";
import { PlacementsSummary } from "@/components/PlacementsSummary";
import { ScreenError } from "@/components/ScreenError";
import { Text } from "@/components/ui/Text";
import { useRefreshable } from "@/hooks/useRefreshable";
import { cn } from "@/lib/cn";
import { hapticSuccess } from "@/lib/haptics";
import { getPlacementsData, keptAccounts } from "@/lib/placements-data";
import { linkableBankAccounts, removeWallet } from "@/lib/savings-accounts";
import { useAuth } from "@/providers/AuthProvider";
import { useFormatCurrency } from "@/providers/CurrencyProvider";
import { useTabBarClearance } from "@/theme/chrome";
import { SurfaceTabs, WALLET_TABS } from "@/components/layout/SurfaceTabs";
import { useLocale, useT } from "@/providers/LocaleProvider";
import { useToast } from "@/providers/ToastProvider";
import { resolveMessage } from "@finance/core/i18n/t";
import { formatSigned } from "@finance/core/amount-sign";

const ADD = "add" as const;

function isSavingsKey(key: AccountKey): key is SavingsAccountKind {
  return !INVESTMENT_WALLET_IDS.includes(key as InvestmentWalletId);
}

/**
 * Placements' first view: what each account holds. What they earn, how the
 * money is spread and what it costs are the Analyse view's
 * (`analysis.tsx`), so this one stays the accounts themselves.
 */
export default function InvestmentsScreen() {
  const t = useT();
  const locale = useLocale();
  const tabBarClearance = useTabBarClearance();
  const { user } = useAuth();
  const formatEuro = useFormatCurrency();
  const { toast } = useToast();
  const [chosen, setChosen] = useState<AccountKey | null>(null);
  const [adding, setAdding] = useState(false);
  const [newPositionIn, setNewPositionIn] = useState<InvestmentWalletId | null>(
    null,
  );
  const [removingWallet, setRemovingWallet] =
    useState<InvestmentWalletId | null>(null);
  const [removePending, setRemovePending] = useState(false);
  const [editingPosition, setEditingPosition] =
    useState<InvestmentPositionItem | null>(null);

  const { data, loading, refreshing, onRefreshAll, onRefresh, error } = useRefreshable(
    async () => (user ? getPlacementsData(user.id, locale) : null),
    [user?.id, locale],
  );

  const portfolio = data?.portfolio;
  // Each holding's own price over a year, for the faint line behind its row.
  // Apart from the rest, as on the web: it asks the market, and the screen
  // does not wait on it.
  const heldSymbols = [
    ...new Set(
      (portfolio?.columns ?? []).flatMap((column) =>
        column.items.flatMap((item) =>
          item.instrumentSymbol ? [item.instrumentSymbol] : [],
        ),
      ),
    ),
  ].sort();
  const symbolsKey = heldSymbols.join(",");
  const { data: priceSeries } = useRefreshable(
    async (): Promise<Record<string, InstrumentPriceSeries>> =>
      symbolsKey
        ? fetchPriceSeriesBySymbol(symbolsKey.split(","), todayIsoLocal())
        : {},
    [symbolsKey],
  );
  const upcoming = data?.upcoming ?? [];
  const nextByWallet = nextUpcomingByWallet(upcoming);
  const fundingNeeds = (data?.fundingNeeds ?? []).filter(
    (need) => need.monthlyTotal > 0,
  );

  // The accounts the user keeps: their savings accounts, then the wallets
  // with positions or that they added.
  const kept = data ? keptAccounts(data) : null;
  const savings = data?.savings ?? { accounts: [], bankAccounts: [] };
  const wallets = kept?.wallets ?? [];
  const savingsKinds = kept?.savingsKinds ?? [];
  const accounts: AccountKey[] = [...savingsKinds, ...wallets];
  const active: AccountKey | null =
    chosen && accounts.includes(chosen) ? chosen : (accounts[0] ?? null);
  const activeWallet =
    active && !isSavingsKey(active) ? (active as InvestmentWalletId) : null;
  const activeSavings = active
    ? savings.accounts.find((view) => view.account.kind === active)
    : undefined;
  const activeColumn = activeWallet
    ? portfolio?.columns.find((entry) => entry.walletId === activeWallet)
    : undefined;
  const activeItems = activeColumn?.items ?? [];
  // The soonest contribution across every account, for the summary.
  const nextContribution =
    Object.values(nextByWallet).sort((left, right) =>
      left.date.localeCompare(right.date),
    )[0] ?? null;

  const savingsTotal = kept?.savingsTotal ?? 0;
  const investedValue = portfolio?.totalMarketValue ?? 0;
  const savingsMonthly = kept?.savingsMonthly ?? {};

  // What goes in each month, wallets then savings accounts, so the savings
  // accounts added sit after Crypto as their own tags.
  const monthlyTags = [
    ...fundingNeeds.map((need) => ({
      key: need.walletId as string,
      label: t(ENVELOPE_SHORT_KEYS[need.walletId]),
      amount: need.monthlyTotal,
    })),
    ...savingsKinds.flatMap((kind) => {
      const amount = savingsMonthly[kind] ?? 0;
      return amount > 0
        ? [{ key: kind as string, label: t(ENVELOPE_SHORT_KEYS[kind]), amount }]
        : [];
    }),
  ];

  const accountOptions = [
    ...accounts.map((id) => ({
      value: id as AccountKey | typeof ADD,
      label: t(ENVELOPE_SHORT_KEYS[id]),
    })),
    { value: ADD as AccountKey | typeof ADD, label: `+ ${t("accounts.add")}` },
  ];

  async function confirmRemoveWallet() {
    if (!removingWallet) {
      return;
    }
    const wallet = removingWallet;
    setRemovePending(true);
    const result = await removeWallet(wallet);
    setRemovePending(false);
    setRemovingWallet(null);
    if (result.error) {
      toast(resolveMessage(t, result.error), "error");
      return;
    }
    void hapticSuccess();
    toast(t("accounts.removed", { name: t(ENVELOPE_SHORT_KEYS[wallet]) }));
    setChosen(null);
  }

  return (
    <Screen title={t("nav.wallets")} className="pb-0">
      {/* The accounts, their analysis and what the funds are made of, as
          the web's strip. */}
      <SurfaceTabs tabs={WALLET_TABS} className="mb-3" />
      {loading && !portfolio ? (
        <ScreenSkeleton rows={3} />
      ) : error ? (
        <ScreenError message={error} onRetry={onRefresh} />
      ) : !portfolio ? (
        <EmptyState
          title={t("wallets.emptyTitleMobile")}
          description={t("wallets.emptyBodyMobile")}
        />
      ) : (
        /*
         * In the web's order: what it is all worth, what goes in each month,
         * then one account and what it holds.
         */
        <ScrollView
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefreshAll} />
          }
          contentContainerClassName="gap-5 pt-2"
          contentContainerStyle={{ paddingBottom: tabBarClearance }}
        >
          <PlacementsSummary
            marketValue={investedValue}
            invested={portfolio.totalInvested}
            gainLoss={portfolio.totalGainLoss}
            hasMarketValue={portfolio.hasMarketSnapshot}
            savingsTotal={savingsTotal}
            streak={data?.streak ?? 0}
            next={nextContribution}
            monthly={monthlyTags.reduce((sum, tag) => sum + tag.amount, 0)}
          />

          {accounts.length === 0 ? (
            <View className="gap-3">
              <EmptyState
                title={t("accounts.emptyTitle")}
                description={t("accounts.emptyBody")}
              />
              <Button
                label={t("accounts.add")}
                size="lg"
                onPress={() => setAdding(true)}
              />
            </View>
          ) : (
            <View className="gap-2">
              <ChipRow
                label={t("accounts.yourAccounts")}
                options={accountOptions}
                value={active ?? ADD}
                onChange={(next) => {
                  if (next === ADD) {
                    setAdding(true);
                    return;
                  }
                  setChosen(next);
                }}
              />
              {/* The acronym spelled out, once, under the chip that uses it. */}
              {activeWallet ? (
                <Text variant="muted" className="px-1 text-xs">
                  {t(INVESTMENT_WALLET_NAME_KEYS[activeWallet])}
                </Text>
              ) : null}
            </View>
          )}

          {activeSavings ? (
            <SavingsAccountCard
              key={activeSavings.account.id}
              view={activeSavings}
              monthly={savingsMonthly[activeSavings.account.kind] ?? 0}
              bankAccounts={linkableBankAccounts(
                savings,
                activeSavings.account.bank_account_id ?? undefined,
              )}
            />
          ) : null}

          {activeWallet ? (
            <View>
              <View className="mb-2 flex-row items-baseline justify-between gap-3">
                <Text className="text-base font-medium">
                  {t("wallets.inWallet", {
                    wallet: t(ENVELOPE_SHORT_KEYS[activeWallet]),
                  })}
                </Text>
                {activeColumn ? (
                  <View className="flex-row items-baseline gap-2">
                    <PrivateAmount className="text-sm font-semibold">
                      {formatEuro(activeColumn.totalMarketValue)}
                    </PrivateAmount>
                    {activeColumn.hasMarketSnapshot &&
                    activeColumn.totalGainLoss !== 0 ? (
                      <PrivateAmount
                        className={cn(
                          "text-xs font-medium",
                          activeColumn.totalGainLoss > 0
                            ? "text-success"
                            : "text-destructive",
                        )}
                      >
                        {formatSigned(activeColumn.totalGainLoss, formatEuro)}
                      </PrivateAmount>
                    ) : null}
                  </View>
                ) : null}
              </View>
              <Card bezel innerClassName="px-4 py-1">
                {activeItems.length === 0 ? (
                  <View className="gap-1 py-4">
                    <Text variant="muted" className="text-sm">
                      {t("wallets.noItems")}
                    </Text>
                    <Text variant="muted" className="text-xs">
                      {t("wallets.trackBody")}
                    </Text>
                  </View>
                ) : (
                  activeItems.map((item, index) => (
                    <View
                      key={item.id}
                      className={index > 0 ? "border-t border-border" : ""}
                    >
                      <InvestmentPositionRow
                        item={item}
                        priceLine={
                          item.instrumentSymbol
                            ? priceSeries?.[item.instrumentSymbol]?.["1Y"]
                            : undefined
                        }
                        onEdit={() => setEditingPosition(item)}
                      />
                    </View>
                  ))
                )}
              </Card>
              <View className="mt-3 flex-row flex-wrap gap-2">
                <Button
                  label={t("position.addItem")}
                  variant="outline"
                  size="sm"
                  onPress={() => setNewPositionIn(activeWallet)}
                />
                <Button
                  label={t("accounts.remove")}
                  variant="ghost"
                  size="sm"
                  onPress={() => setRemovingWallet(activeWallet)}
                />
              </View>
            </View>
          ) : null}

          {/* The PEA's ceiling and five-year clock are about this one
              account, so they sit under it rather than in the analysis. */}
          {activeWallet === "pea" && data ? (
            <PeaCard
              invested={
                portfolio?.columns.find((column) => column.walletId === "pea")
                  ?.totalInvested ?? 0
              }
              plan={data.plans.find((plan) => plan.wallet === "pea")}
            />
          ) : null}

        </ScrollView>
      )}

      {editingPosition ? (
        <InvestmentPositionSheet
          key={editingPosition.id}
          item={editingPosition}
          onClose={() => setEditingPosition(null)}
        />
      ) : null}
      <NewPositionSheet
        wallet={newPositionIn}
        onClose={() => setNewPositionIn(null)}
      />
      <AddAccountSheet
        open={adding}
        takenSavings={savingsKinds}
        takenWallets={wallets}
        bankAccounts={linkableBankAccounts(savings)}
        onClose={() => setAdding(false)}
        onAdded={setChosen}
      />
      <ConfirmSheet
        open={removingWallet !== null}
        title={
          removingWallet
            ? t("accounts.removeWalletConfirm", {
                name: t(ENVELOPE_SHORT_KEYS[removingWallet]),
                count:
                  portfolio?.columns.find(
                    (column) => column.walletId === removingWallet,
                  )?.items.length ?? 0,
              })
            : ""
        }
        confirmLabel={t("accounts.remove")}
        pending={removePending}
        onCancel={() => setRemovingWallet(null)}
        onConfirm={() => void confirmRemoveWallet()}
      />
    </Screen>
  );
}

"use client";

import { useMemo, useState } from "react";
import { Plus } from "@phosphor-icons/react";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { InvestmentPositionSheet } from "@/components/finance/InvestmentPositionSheet";
import { StatHero } from "@/components/finance/StatHero";
import { Stagger, StaggerItem } from "@/components/motion/Stagger";
import { AddAccountSheet } from "@/components/finance/accounts/AddAccountSheet";
import { SavingsAccountPanel } from "@/components/finance/accounts/SavingsAccountPanel";
import { PeaCard } from "@/components/finance/PeaCard";
import {
  accountShortName,
  isSavingsKind,
  type AccountId,
} from "@/components/finance/accounts/account-format";
import { removeWallet } from "@/lib/actions/accounts";
import type { SavingsAccountsRead } from "@/lib/queries/savings-accounts";
import { SAVINGS_KINDS } from "@finance/core/savings-accounts";
import type { InstrumentPriceSeries } from "@finance/core/instrument-price-series";
import type { WalletFundingNeed } from "@finance/core/investment-upcoming";
import {
  INVESTMENT_WALLET_IDS,
  type InvestmentWalletId,
} from "@finance/core/investments";
import type {
  SavingsAccountKind,
  WalletPlan,
} from "@finance/core/types/database";
import {
  portfolioHasActivity,
  recurringTemplatesForWallet,
  type InvestmentColumnSummary,
  type InvestmentPortfolioSummary,
  type InvestmentPositionItem,
} from "@finance/core/investment-positions";
import { cn } from "@/lib/utils";
import { useFormatCurrency } from "@/lib/use-currency";
import type { RecurringTemplateWithCategory } from "@finance/core/types/database";
import { ICON } from "@/lib/icon-scale";
import { useLocale, useT } from "@/lib/locale-context";
import { formatSigned } from "@finance/core/amount-sign";
import { WalletPanel } from "@/components/finance/investments/WalletPanel";

interface InvestmentsViewProps {
  portfolio: InvestmentPortfolioSummary;
  recurringTemplates: RecurringTemplateWithCategory[];
  fundingNeeds: WalletFundingNeed[];
  /** What each held instrument's price did, keyed by symbol. */
  priceSeries: Record<string, InstrumentPriceSeries>;
  /** The savings accounts the user has declared, and what each holds. */
  savings: SavingsAccountsRead;
  /** The wallets the user keeps: those with holdings, and those added. */
  keptWallets: InvestmentWalletId[];
  /** What the recurring entries put into each savings account a month. */
  savingsMonthly: Partial<Record<SavingsAccountKind, number>>;
  /** Each wallet's plan row: the PEA's opening date and ceiling live there. */
  plans: WalletPlan[];
}

/**
 * Placements: every account the user keeps — savings accounts first, then the
 * investment wallets — one at a time, and the way to add or remove one.
 *
 * The list is the user's own. It used to be all five wallets for everyone,
 * an assurance vie offered to a reader who will never open one and no place
 * at all for the LDDS they do have.
 */
export function InvestmentsView({
  portfolio,
  recurringTemplates,
  fundingNeeds,
  priceSeries,
  savings,
  keptWallets,
  savingsMonthly,
  plans,
}: InvestmentsViewProps) {
  const t = useT();
  const locale = useLocale();
  const formatEuro = useFormatCurrency();
  const accounts: AccountId[] = [
    ...savings.accounts.map((account) => account.kind),
    ...keptWallets,
  ];
  const [chosen, setChosen] = useState<AccountId | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  // The account chosen, while it is still there; else the first one.
  const selected =
    chosen !== null && accounts.includes(chosen)
      ? chosen
      : (accounts[0] ?? null);
  const activeWallet: InvestmentWalletId =
    selected !== null && !isSavingsKind(selected) ? selected : "pea";
  const selectedSavings =
    selected !== null && isSavingsKind(selected)
      ? savings.accounts.find((account) => account.kind === selected)
      : undefined;
  const [editingItem, setEditingItem] = useState<InvestmentPositionItem | null>(
    null,
  );
  const [addingWallet, setAddingWallet] = useState<InvestmentWalletId | null>(
    null,
  );

  const trackedRecurringIds = useMemo(
    () =>
      new Set(
        portfolio.columns.flatMap((column) =>
          column.items
            .map((item) => item.recurringTemplateId)
            .filter((id): id is string => id !== null),
        ),
      ),
    [portfolio.columns],
  );

  const sheetOpen = editingItem !== null || addingWallet !== null;
  const sheetWallet = editingItem?.walletId ?? addingWallet ?? activeWallet;
  const recurringOptions = recurringTemplatesForWallet(
    sheetWallet,
    recurringTemplates,
    trackedRecurringIds,
  );

  const hasData = portfolioHasActivity(portfolio);
  // One tag per account something goes into each month: the wallets, then
  // the savings accounts, by the same rule the savings panel and the Plan use.
  const visibleFunding = [
    ...fundingNeeds
      .filter((need) => need.monthlyTotal > 0)
      .map((need) => ({
        id: need.walletId as AccountId,
        monthly: need.monthlyTotal,
      })),
    ...savings.accounts
      .map((account) => ({
        id: account.kind as AccountId,
        monthly: savingsMonthly[account.kind] ?? 0,
      }))
      .filter((tag) => tag.monthly > 0),
  ];
  const showPl = portfolio.hasMarketSnapshot && portfolio.totalGainLoss !== 0;
  const savingsTotal = savings.accounts.reduce(
    (sum, account) => sum + account.balance.balance,
    0,
  );
  const total = savingsTotal + portfolio.totalMarketValue;
  const missingSavings = SAVINGS_KINDS.filter(
    (kind) => !savings.accounts.some((account) => account.kind === kind),
  );
  const missingWallets = INVESTMENT_WALLET_IDS.filter(
    (wallet) => !keptWallets.includes(wallet),
  );

  const activeColumn =
    portfolio.columns.find((entry) => entry.walletId === activeWallet) ??
    emptyColumn(activeWallet);

  // The header, the views and the quotes' refresh are Placements' layout's,
  // so they stay put while the views load.
  return (
    <>
      <Stagger
        className="flex w-full min-w-0 flex-col items-center gap-8 md:gap-10"
        stagger={0.05}
      >
        <StaggerItem className="w-full min-w-0">
          <StatHero
            label={t("accounts.total")}
            amount={formatEuro(total)}
            animateValue={total}
            format={formatEuro}
            subtitle={
              <p>
                {savings.accounts.length > 0 ? (
                  <span className="privacy-sensitive block">
                    {t("accounts.split", {
                      savings: formatEuro(savingsTotal),
                      investments: formatEuro(portfolio.totalMarketValue),
                    })}
                  </span>
                ) : null}
                <span className="privacy-amount">
                  {formatEuro(portfolio.totalInvested)}
                </span>{" "}
                {t("wallets.investedSuffix")}
                {showPl ? (
                  <>
                    {" · "}
                    <span
                      className={cn(
                        "privacy-amount font-mono font-medium",
                        portfolio.totalGainLoss > 0
                          ? "text-success"
                          : "text-destructive",
                      )}
                    >
                      {formatSigned(portfolio.totalGainLoss, formatEuro)}
                    </span>
                  </>
                ) : null}
              </p>
            }
          />
        </StaggerItem>

        {visibleFunding.length > 0 ? (
          <StaggerItem className="w-full">
            {/* One row of tags rather than one sentence per wallet: three
                  lines of "Send to X €Y / month" is three lines of height for
                  three numbers, and the wallet name is label enough. */}
            <ul
              aria-label={t("wallets.fundingLabel")}
              className="flex flex-wrap items-center justify-center gap-2"
            >
              {visibleFunding.map((tag) => (
                <li
                  key={tag.id}
                  className="flex items-baseline gap-1.5 rounded-full border border-border px-3 py-1 text-xs text-muted-foreground sm:text-sm"
                >
                  <span>{accountShortName(tag.id, locale)}</span>
                  <span className="privacy-amount font-mono font-medium text-foreground tabular-nums">
                    {formatEuro(tag.monthly)}
                  </span>
                  <span>{t("wallets.perMonth")}</span>
                </li>
              ))}
            </ul>
          </StaggerItem>
        ) : null}

        {accounts.length === 0 ? (
          <StaggerItem className="w-full">
            <EmptyState
              title={t("accounts.emptyTitle")}
              description={t("accounts.emptyBody")}
            >
              <Button onClick={() => setAddOpen(true)}>
                <Plus size={ICON.md} weight="bold" className="mr-1.5" />
                {t("accounts.add")}
              </Button>
            </EmptyState>
          </StaggerItem>
        ) : !hasData && savings.accounts.length === 0 ? (
          <StaggerItem className="w-full">
            <EmptyState
              title={t("wallets.emptyTitle")}
              description={t("wallets.emptyBody")}
            />
          </StaggerItem>
        ) : null}

        <StaggerItem className="w-full min-w-0">
          {/* A group of toggles, not tabs. `role="tablist"` over
                `role="tab"` was a promise the markup did not keep: the panel
                below is not a `tabpanel`, nothing carries `aria-controls`,
                and there was neither a roving `tabIndex` nor a key handler —
                so a screen reader announced a tab set and then the arrow keys
                did nothing. `aria-pressed` on plain buttons says which wallet
                is in force and claims no keys the control does not handle. */}
          {accounts.length > 0 ? (
            <div
              className="flex w-full min-w-0 flex-wrap justify-center gap-2"
              role="group"
              aria-label={t("accounts.yourAccounts")}
            >
              {accounts.map((id) => {
                const active = selected === id;

                return (
                  <button
                    key={id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setChosen(id)}
                    className={cn(
                      "min-h-11 shrink-0 rounded-full border px-4 py-2 text-sm font-semibold lg:min-h-0",
                      "transition-colors duration-hover",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      active
                        ? "border-foreground bg-foreground text-background"
                        : "border-border text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {accountShortName(id, locale)}
                  </button>
                );
              })}
              {missingSavings.length + missingWallets.length > 0 ? (
                <button
                  type="button"
                  onClick={() => setAddOpen(true)}
                  className={cn(
                    "flex min-h-11 shrink-0 items-center gap-1.5 rounded-full border border-border px-4 py-2 text-sm text-muted-foreground lg:min-h-0",
                    "transition-colors duration-hover hover:bg-muted hover:text-foreground",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  )}
                >
                  <Plus size={ICON.sm} weight="bold" aria-hidden />
                  {t("accounts.add")}
                </button>
              ) : null}
            </div>
          ) : null}
        </StaggerItem>

        {selectedSavings ? (
          <StaggerItem className="w-full min-w-0">
            <SavingsAccountPanel
              key={selectedSavings.id}
              account={selectedSavings}
              monthly={savingsMonthly[selectedSavings.kind] ?? 0}
              linkable={savings.linkable}
            />
          </StaggerItem>
        ) : selected !== null ? (
          <StaggerItem className="w-full min-w-0">
            <WalletPanel
              key={activeWallet}
              column={activeColumn}
              priceSeries={priceSeries}
              onEdit={setEditingItem}
              onAdd={() => setAddingWallet(activeWallet)}
              removeConfirm={t("accounts.removeWalletConfirm", {
                name: accountShortName(activeWallet, locale),
                count: activeColumn.items.length,
              })}
              onRemove={() => removeWallet(activeWallet)}
            />
          </StaggerItem>
        ) : null}

        {/* The PEA's ceiling and five-year clock are about the PEA alone,
              so they sit with it. */}
        {selected === "pea" ? (
          <StaggerItem className="w-full min-w-0">
            <PeaCard
              column={activeColumn}
              plan={plans.find((plan) => plan.wallet === "pea")}
            />
          </StaggerItem>
        ) : null}
      </Stagger>

      <AddAccountSheet
        open={addOpen}
        onOpenChange={setAddOpen}
        savingsKinds={missingSavings}
        wallets={missingWallets}
        savingsAvailable={savings.available}
        linkable={savings.linkable}
        onAdded={setChosen}
      />

      <InvestmentPositionSheet
        item={editingItem}
        walletId={sheetWallet}
        recurringOptions={recurringOptions}
        open={sheetOpen}
        onOpenChange={(open) => {
          if (!open) {
            setEditingItem(null);
            setAddingWallet(null);
          }
        }}
      />
    </>
  );
}

function emptyColumn(walletId: InvestmentWalletId): InvestmentColumnSummary {
  return {
    walletId,
    items: [],
    totalInvested: 0,
    totalMarketValue: 0,
    totalGainLoss: 0,
    hasMarketSnapshot: false,
    chartPoints: [],
  };
}

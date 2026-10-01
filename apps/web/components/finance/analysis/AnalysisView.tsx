"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import type { AccountId, AccountTarget } from "@finance/core/allocation";
import { chargeToInput, formatCharge } from "@finance/core/fund-costs";
import type { InvestmentPortfolioSummary } from "@finance/core/investment-positions";
import {
  returnUnavailableLabel,
  type InvestmentReturns,
} from "@finance/core/investment-returns";
import type { InvestmentWalletId } from "@finance/core/investments";
import { FRENCH_SAVINGS_2026 } from "@finance/core/savings-accounts";
import type { WalletPlan } from "@finance/core/types/database";
import { formatAnnualRate } from "@finance/core/xirr";
import { AllocationCard } from "@/components/finance/AllocationCard";
import { FundCostCard } from "@/components/finance/FundCostCard";
import {
  accountShortName,
  formatRate,
} from "@/components/finance/accounts/account-format";
import { EmptyState } from "@/components/layout/EmptyState";
import { useToast } from "@/components/layout/ToastProvider";
import { Stagger, StaggerItem } from "@/components/motion/Stagger";
import { Button } from "@/components/retroui/Button";
import { Card } from "@/components/retroui/Card";
import { saveWalletPlan } from "@/lib/actions/investments";
import type { SavingsAccountView } from "@/lib/queries/savings-accounts";
import { useFormatCurrency } from "@/lib/use-currency";
import { cn } from "@/lib/utils";
import { useLocale, useT } from "@/lib/locale-context";

interface AnalysisViewProps {
  portfolio: InvestmentPortfolioSummary;
  returns: InvestmentReturns;
  plans: WalletPlan[];
  savingsAccounts: SavingsAccountView[];
  keptWallets: InvestmentWalletId[];
  /** Every account kept, savings first. */
  accounts: AccountId[];
  values: Partial<Record<AccountId, number>>;
  monthly: Partial<Record<AccountId, number>>;
  targets: AccountTarget[];
  monthlyContribution: number;
}

/**
 * Placements' second tab: what each account earns, how the money is spread
 * across them, and what it costs to hold — the questions asked of all the
 * accounts at once, kept apart from Comptes, which shows one account at a
 * time.
 */
export function AnalysisView({
  portfolio,
  returns,
  plans,
  savingsAccounts,
  keptWallets,
  accounts,
  values,
  monthly,
  targets,
  monthlyContribution,
}: AnalysisViewProps) {
  const t = useT();

  if (accounts.length === 0) {
    return (
      <EmptyState
        title={t("accounts.emptyTitle")}
        description={t("placementsWeb.analysisEmpty")}
      >
        <Button render={<Link href="/investments" />}>
          {t("placementsWeb.analysisEmptyCta")}
        </Button>
      </EmptyState>
    );
  }

  // One card per wrapper that charges a fee of its own, once it holds money.
  const feeWallets = (["av", "per"] as const).filter(
    (wallet) =>
      keptWallets.includes(wallet) &&
      portfolio.columns.some(
        (column) => column.walletId === wallet && column.totalMarketValue > 0,
      ),
  );

  return (
    <Stagger className="flex w-full flex-col gap-4" stagger={0.05}>
      <StaggerItem>
        <p className="max-w-prose text-sm text-muted-foreground">
          {t("accounts.analysisIntro")}
        </p>
      </StaggerItem>

      <StaggerItem>
        <ReturnCard
          returns={returns}
          hasWallets={keptWallets.length > 0}
          savingsAccounts={savingsAccounts}
        />
      </StaggerItem>

      <StaggerItem>
        <AllocationCard
          accounts={accounts}
          values={values}
          monthly={monthly}
          targets={targets}
          monthlyContribution={monthlyContribution}
        />
      </StaggerItem>

      <StaggerItem>
        <section className="flex flex-col gap-4">
          <h2 className="font-head text-base">
            {t("placementsWeb.feesTitle")}
          </h2>
          {keptWallets.length > 0 ? (
            <FundCostCard portfolio={portfolio} />
          ) : null}
          {feeWallets.map((wallet) => (
            <Card.Bezel
              key={wallet}
              className="w-full"
              innerClassName="p-5 md:p-6"
            >
              <EnvelopeFeeField
                wallet={wallet}
                fee={
                  plans.find((plan) => plan.wallet === wallet)?.wrapper_fee ??
                  null
                }
              />
            </Card.Bezel>
          ))}
          {savingsAccounts.length > 0 ? (
            <SavingsFeesLine accounts={savingsAccounts} />
          ) : null}
        </section>
      </StaggerItem>
    </Stagger>
  );
}

/**
 * What the money earns a year: the investments' money-weighted return, each
 * wallet's own, and each savings account's rate after its tax — which is
 * all a livret earns, since its price never moves.
 */
function ReturnCard({
  returns,
  hasWallets,
  savingsAccounts,
}: {
  returns: InvestmentReturns;
  hasWallets: boolean;
  savingsAccounts: SavingsAccountView[];
}) {
  const t = useT();
  const locale = useLocale();
  const formatEuro = useFormatCurrency();

  // Only the accounts with a return to state: one with no dated money in it
  // has nothing to annualise.
  const walletRates = returns.wallets.flatMap((row) => {
    const rate = formatAnnualRate(row.rate, locale);
    return rate ? [{ walletId: row.walletId, rate }] : [];
  });
  const portfolioRate = formatAnnualRate(returns.total.rate, locale);

  return (
    <Card.Bezel className="w-full" innerClassName="p-5 md:p-6">
      {hasWallets ? (
        <>
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                {t("position.moneyWeightedReturn")}
              </p>
              <p
                className={cn(
                  "mt-1 font-serif text-4xl font-semibold tabular-nums",
                  returns.total.rate === null
                    ? "text-muted-foreground"
                    : returns.total.rate >= 0
                      ? "text-success"
                      : "text-destructive",
                )}
              >
                {portfolioRate ??
                  returnUnavailableLabel(
                    returns.total.unavailableReason,
                    locale,
                  )}
              </p>
            </div>
            <p className="text-sm text-muted-foreground">
              <span className="privacy-amount tabular-nums text-foreground">
                {formatEuro(returns.total.invested)}
              </span>{" "}
              {t("position.amountIn")} ·{" "}
              <span className="privacy-amount tabular-nums text-foreground">
                {formatEuro(returns.total.currentValue)}
              </span>{" "}
              {t("position.amountNow")}
            </p>
          </div>
          {walletRates.length > 1 ? (
            <p className="mt-3 text-sm text-muted-foreground">
              {t("position.returnByAccount")}:{" "}
              {walletRates.map(({ walletId, rate }, index) => (
                <span key={walletId}>
                  {index > 0 ? " · " : ""}
                  {accountShortName(walletId, locale)}{" "}
                  <span className="tabular-nums text-foreground">{rate}</span>
                </span>
              ))}
            </p>
          ) : null}
          <p className="mt-3 max-w-prose text-sm text-muted-foreground">
            {t("position.returnExplainer")}
          </p>
        </>
      ) : null}

      {savingsAccounts.length > 0 ? (
        <div className={cn(hasWallets && "mt-4 border-t border-border pt-4")}>
          <p className="text-sm font-medium text-muted-foreground">
            {t("placementsWeb.returnsSavings")}
          </p>
          <ul className="mt-2 flex flex-col gap-1 text-sm">
            {savingsAccounts.map((account) => (
              <li
                key={account.kind}
                className="flex flex-wrap items-baseline justify-between gap-x-3"
              >
                <span className="font-medium">
                  {accountShortName(account.kind, locale)}
                </span>
                <span className="tabular-nums text-muted-foreground">
                  {t("accounts.returnSavings", {
                    rate: formatRate(
                      account.rate *
                        (1 - FRENCH_SAVINGS_2026[account.kind].taxOnInterest),
                      locale,
                    ),
                  })}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-muted-foreground">
            {t("accounts.returnSavingsHint")}
          </p>
        </div>
      ) : null}
    </Card.Bezel>
  );
}

/** A savings account charges nothing to hold, which is worth one quiet line. */
function SavingsFeesLine({ accounts }: { accounts: SavingsAccountView[] }) {
  const t = useT();
  const locale = useLocale();
  return (
    <p className="text-sm text-muted-foreground">
      {accounts
        .map((account) => accountShortName(account.kind, locale))
        .join(" · ")}{" "}
      — {t("accounts.feesNone")}
    </p>
  );
}

/**
 * What the envelope itself charges, a year.
 *
 * An assurance-vie takes a fee on the whole contract, on top of every unit's
 * own ongoing charge — which is why the same fund can cost four times as much
 * there as in a PEA. Nothing can compute that comparison without this number,
 * and no free source publishes it per contract, so it is typed in the way a
 * fund's charge is.
 *
 * Typed as a percentage and stored as a fraction, the same convention as
 * `ongoing_charge`, so the look-through can add the two together without
 * either side remembering which unit it is in.
 */
function EnvelopeFeeField({
  wallet,
  fee,
}: {
  wallet: "av" | "per";
  fee: number | null;
}) {
  const t = useT();
  const locale = useLocale();
  const { toast } = useToast();
  const [value, setValue] = useState(chargeToInput(fee));
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={`envelope-fee-${wallet}`} className="text-sm font-medium">
        {accountShortName(wallet, locale)} · {t("lookThrough.envelopeFee")}
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1">
          <input
            id={`envelope-fee-${wallet}`}
            type="text"
            inputMode="decimal"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            placeholder="0,75"
            className="h-10 min-h-11 lg:min-h-0 w-24 rounded-control border border-border bg-background px-3 text-base"
          />
          <span className="text-sm text-muted-foreground">%</span>
        </div>
        <Button
          variant="outline"
          size="sm"
          disabled={pending || value === chargeToInput(fee)}
          onClick={() =>
            startTransition(async () => {
              const result = await saveWalletPlan({
                wallet,
                wrapperFee: value,
              });
              if (result.error) {
                toast(result.error, "error");
                return;
              }
              toast(t("position.saved"), "success");
            })
          }
        >
          {pending ? t("position.saving") : t("position.save")}
        </Button>
        {fee !== null ? (
          <span className="text-sm text-muted-foreground">
            {formatCharge(fee, locale)}
          </span>
        ) : null}
      </div>
      <p className="text-sm text-muted-foreground">
        {t("lookThrough.envelopeFeeHint")}
      </p>
    </div>
  );
}

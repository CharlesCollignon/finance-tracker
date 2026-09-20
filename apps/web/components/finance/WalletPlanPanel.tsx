"use client";

import { useMemo, useState, useTransition } from "react";
import { PencilSimple } from "@phosphor-icons/react";
import {
  buildAllocation,
  formatWeight,
  suggestContributionSplit,
  type WalletTarget,
} from "@finance/core/allocation";
import { INVESTMENT_WALLET_LABELS } from "@finance/core/investments";
import type { InvestmentPortfolioSummary } from "@finance/core/investment-positions";
import {
  returnUnavailableLabel,
  type InvestmentReturns,
} from "@finance/core/investment-returns";
import { buildPeaStatus, peaMaturityHint } from "@finance/core/pea";
import { chargeToInput, formatCharge } from "@finance/core/fund-costs";
import { todayIsoLocal } from "@finance/core/constants";
import { formatAnnualRate } from "@finance/core/xirr";
import type { WalletPlan } from "@finance/core/types/database";
import { Button } from "@/components/retroui/Button";
import { Card } from "@/components/retroui/Card";
import { useToast } from "@/components/layout/ToastProvider";
import { saveWalletPlan, saveWalletTargets } from "@/lib/actions/investments";
import { useFormatCurrency } from "@/lib/use-currency";
import { cn } from "@/lib/utils";
import { ICON } from "@/lib/icon-scale";
import { useLocale, useT } from "@/lib/locale-context";

interface WalletPlanPanelProps {
  portfolio: InvestmentPortfolioSummary;
  returns: InvestmentReturns;
  plans: WalletPlan[];
  /** Typical monthly contribution, used to suggest where the next one goes. */
  monthlyContribution: number;
}

/**
 * The part of the investments screen that says what to do, rather than what is.
 *
 * Three things the app knows but never said: what the portfolio actually
 * returned (money-weighted, so a monthly drip is not flattered by a rising
 * balance), how far the split has drifted from what the user intended, and —
 * for a PEA — how much room is left under the ceiling and when the five-year
 * clock is reached.
 */
export function WalletPlanPanel({
  portfolio,
  returns,
  plans,
  monthlyContribution,
}: WalletPlanPanelProps) {
  const t = useT();
  const formatEuro = useFormatCurrency();
  const locale = useLocale();
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();

  const planByWallet = useMemo(
    () => new Map(plans.map((plan) => [plan.wallet, plan])),
    [plans],
  );

  const targets: WalletTarget[] = useMemo(
    () =>
      portfolio.columns.map((column) => ({
        walletId: column.walletId,
        targetWeight:
          planByWallet.get(column.walletId)?.target_weight === null ||
          planByWallet.get(column.walletId)?.target_weight === undefined
            ? null
            : Number(planByWallet.get(column.walletId)!.target_weight),
      })),
    [portfolio.columns, planByWallet],
  );

  const allocation = useMemo(
    () =>
      buildAllocation(
        portfolio.columns.map((column) => ({
          walletId: column.walletId,
          value: column.totalMarketValue,
        })),
        targets,
      ),
    [portfolio.columns, targets],
  );

  const split = useMemo(
    () => suggestContributionSplit(allocation, monthlyContribution),
    [allocation, monthlyContribution],
  );

  const returnByWallet = useMemo(
    () => new Map(returns.wallets.map((row) => [row.walletId, row])),
    [returns.wallets],
  );

  const peaPlan = planByWallet.get("pea");
  const peaColumn = portfolio.columns.find((c) => c.walletId === "pea");
  const peaStatus = peaColumn
    ? buildPeaStatus(
        peaColumn.totalInvested,
        peaPlan?.opened_on ?? null,
        todayIsoLocal(),
        peaPlan?.contribution_ceiling
          ? Number(peaPlan.contribution_ceiling)
          : undefined,
      )
    : null;

  const portfolioRate = formatAnnualRate(returns.total.rate, locale);

  return (
    <div className="flex w-full flex-col gap-4">
      {/* ---- headline return -------------------------------------- */}
      <Card.Bezel className="w-full" innerClassName="p-5 md:p-6">
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
                returnUnavailableLabel(returns.total.unavailableReason, locale)}
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
        <p className="mt-3 max-w-prose text-sm text-muted-foreground">
          {t("position.returnExplainer")}
        </p>
      </Card.Bezel>

      {/* ---- allocation -------------------------------------------- */}
      <Card.Bezel className="w-full" innerClassName="p-5 md:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-head text-base">{t("position.allocation")}</h2>
          <Button
            variant="link"
            size="sm"
            onClick={() => setEditing((value) => !value)}
          >
            <PencilSimple size={ICON.sm} className="mr-1 inline" />
            {editing ? t("position.cancel") : t("position.setTargets")}
          </Button>
        </div>

        {editing ? (
          <TargetEditor
            initial={targets}
            pending={pending}
            onSave={(next) =>
              startTransition(async () => {
                const result = await saveWalletTargets(
                  next.map((row) => ({
                    wallet: row.walletId,
                    targetWeight: row.targetWeight ?? 0,
                  })),
                );
                if (result.error) {
                  toast(result.error, "error");
                  return;
                }
                toast(t("position.targetsSaved"), "success");
                setEditing(false);
              })
            }
          />
        ) : (
          <ul className="mt-4 flex flex-col gap-3">
            {allocation.rows.map((row) => {
              const walletReturn = returnByWallet.get(row.walletId);
              const rate = formatAnnualRate(walletReturn?.rate ?? null, locale);

              return (
                <li key={row.walletId} className="flex flex-col gap-1.5">
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="font-medium">
                      {INVESTMENT_WALLET_LABELS[row.walletId]}
                    </span>
                    <span className="privacy-amount tabular-nums">
                      {formatEuro(row.value)}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-x-3 text-xs text-muted-foreground">
                    <span>
                      {formatWeight(row.currentWeight)}
                      {row.targetWeight !== null
                        ? ` ${t("position.ofTarget", {
                            target: formatWeight(row.targetWeight),
                          })}`
                        : ""}
                      {rate ? ` · ${rate}` : ""}
                    </span>
                    {row.status === "over" || row.status === "under" ? (
                      <span
                        className={
                          row.status === "over"
                            ? "text-destructive"
                            : "text-muted-foreground"
                        }
                      >
                        {row.status === "over" ? "+" : ""}
                        {Math.round(row.driftPoints ?? 0)} pts
                      </span>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {!editing && allocation.needsRebalance && split.length > 0 ? (
          <p className="mt-4 border-t border-border pt-4 text-sm">
            <span className="text-muted-foreground">
              {t("position.splitLeadPrefix")}{" "}
              <span className="privacy-amount tabular-nums">
                {formatEuro(monthlyContribution)}
              </span>{" "}
              {t("position.splitLeadSuffix")}{" "}
            </span>
            {split.map((row, index) => (
              <span key={row.walletId}>
                {index > 0 ? ", " : ""}
                <span className="privacy-amount font-medium tabular-nums">
                  {formatEuro(row.amount)}
                </span>{" "}
                {t("position.splitItemTo", {
                  wallet: INVESTMENT_WALLET_LABELS[row.walletId],
                })}
              </span>
            ))}
            <span className="text-muted-foreground">
              {" "}
              {t("position.splitTail")}
            </span>
          </p>
        ) : null}

        {!editing && allocation.targetCoverage === 0 ? (
          <p className="mt-4 border-t border-border pt-4 text-sm text-muted-foreground">
            {t("position.noTargetHint")}
          </p>
        ) : null}
      </Card.Bezel>

      {/* ---- PEA ---------------------------------------------------- */}
      {peaStatus ? (
        <Card.Bezel className="w-full" innerClassName="p-5 md:p-6">
          <h2 className="font-head text-base">PEA</h2>

          <div className="mt-3 flex flex-wrap items-baseline justify-between gap-2 text-sm">
            <span className="text-muted-foreground">
              {t("position.peaPaidIn")}{" "}
              <span className="privacy-amount tabular-nums text-foreground">
                {formatEuro(peaStatus.contributed)}
              </span>{" "}
              {t("position.peaOfCeiling", {
                ceiling: formatEuro(peaStatus.ceiling),
              })}{" "}
              —{" "}
              <span className="privacy-amount tabular-nums">
                {formatWeight(peaStatus.ratio)}
              </span>
            </span>
            <span
              className={cn(
                "tabular-nums",
                peaStatus.nearCeiling
                  ? "text-destructive"
                  : "text-muted-foreground",
              )}
            >
              <span className="privacy-amount">
                {formatEuro(peaStatus.headroom)}
              </span>{" "}
              {t("position.peaRoomLeft")}
            </span>
          </div>

          <p className="mt-3 text-sm text-muted-foreground">
            {t("position.peaCashOnly")}
          </p>

          <PeaOpenedField
            openedOn={peaPlan?.opened_on ?? null}
            hint={peaMaturityHint(peaStatus, locale)}
          />
        </Card.Bezel>
      ) : null}

      {/* One card per wrapper that charges a fee of its own. */}
      {(["av", "per"] as const)
        .filter((wallet) =>
          portfolio.columns.some(
            (column) =>
              column.walletId === wallet && column.totalMarketValue > 0,
          ),
        )
        .map((wallet) => (
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
    </div>
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
  const { toast } = useToast();
  const [value, setValue] = useState(chargeToInput(fee));
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={`envelope-fee-${wallet}`} className="text-sm font-medium">
        {INVESTMENT_WALLET_LABELS[wallet]} · {t("lookThrough.envelopeFee")}
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
            {formatCharge(fee)}
          </span>
        ) : null}
      </div>
      <p className="text-sm text-muted-foreground">
        {t("lookThrough.envelopeFeeHint")}
      </p>
    </div>
  );
}

function TargetEditor({
  initial,
  pending,
  onSave,
}: {
  initial: WalletTarget[];
  pending: boolean;
  onSave: (targets: WalletTarget[]) => void;
}) {
  const t = useT();
  const [draft, setDraft] = useState(() =>
    initial.map((target) => ({
      walletId: target.walletId,
      percent: Math.round((target.targetWeight ?? 0) * 100),
    })),
  );

  const total = draft.reduce((sum, row) => sum + row.percent, 0);

  return (
    <div className="mt-4 flex flex-col gap-3">
      {draft.map((row) => (
        <label
          key={row.walletId}
          className="flex items-center justify-between gap-3 text-sm"
        >
          <span>{INVESTMENT_WALLET_LABELS[row.walletId]}</span>
          <span className="flex items-center gap-2">
            <input
              type="number"
              min={0}
              max={100}
              step={1}
              value={row.percent}
              onChange={(event) =>
                setDraft((current) =>
                  current.map((item) =>
                    item.walletId === row.walletId
                      ? { ...item, percent: Number(event.target.value) }
                      : item,
                  ),
                )
              }
              className="h-10 min-h-11 lg:min-h-0 w-20 rounded-control border border-border bg-background px-2 text-right tabular-nums"
            />
            <span className="text-muted-foreground">%</span>
          </span>
        </label>
      ))}

      <p
        className={cn(
          "text-sm tabular-nums",
          total === 100 ? "text-muted-foreground" : "text-destructive",
        )}
      >
        {total}% allocated{total === 100 ? "" : " — must total 100%"}
      </p>

      <Button
        disabled={pending || total !== 100}
        onClick={() =>
          onSave(
            draft.map((row) => ({
              walletId: row.walletId,
              targetWeight: row.percent / 100,
            })),
          )
        }
      >
        {pending ? t("position.saving") : t("position.saveTargets")}
      </Button>
    </div>
  );
}

/** The one date that starts a PEA's five-year clock. */
function PeaOpenedField({
  openedOn,
  hint,
}: {
  openedOn: string | null;
  hint: string | null;
}) {
  const t = useT();
  const { toast } = useToast();
  const [value, setValue] = useState(openedOn ?? "");
  const [pending, startTransition] = useTransition();

  return (
    <div className="mt-4 flex flex-col gap-2 border-t border-border pt-4">
      <label htmlFor="pea-opened" className="text-sm font-medium">
        {t("position.openedOn")}
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <input
          id="pea-opened"
          type="date"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          className="h-10 min-h-11 lg:min-h-0 rounded-control border border-border bg-background px-3 text-base"
        />
        <Button
          variant="outline"
          size="sm"
          disabled={pending || value === (openedOn ?? "")}
          onClick={() =>
            startTransition(async () => {
              const result = await saveWalletPlan({
                wallet: "pea",
                openedOn: value,
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
      </div>
      {hint ? (
        <p className="text-sm text-muted-foreground">{hint}</p>
      ) : (
        <p className="text-sm text-muted-foreground">
          Add the date to track the five-year mark.
        </p>
      )}
    </div>
  );
}

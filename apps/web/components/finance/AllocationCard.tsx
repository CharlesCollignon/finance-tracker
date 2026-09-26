"use client";

import { useMemo, useState, useTransition } from "react";
import { PencilSimple, Trash } from "@phosphor-icons/react";
import {
  buildAllocation,
  currentSplitPercents,
  formatWeight,
  suggestContributionSplit,
  type AllocationRow,
  type WalletTarget,
} from "@finance/core/allocation";
import {
  INVESTMENT_WALLET_LABELS,
  type InvestmentWalletId,
} from "@finance/core/investments";
import type { InvestmentPortfolioSummary } from "@finance/core/investment-positions";
import type { WalletFundingNeed } from "@finance/core/investment-upcoming";
import type { WalletPlan } from "@finance/core/types/database";
import { Button } from "@/components/retroui/Button";
import { Card } from "@/components/retroui/Card";
import { useToast } from "@/components/layout/ToastProvider";
import {
  clearWalletTargets,
  saveWalletTargets,
} from "@/lib/actions/investments";
import { useFormatCurrency } from "@/lib/use-currency";
import { cn } from "@/lib/utils";
import { ICON } from "@/lib/icon-scale";
import { useT } from "@/lib/locale-context";

interface AllocationCardProps {
  portfolio: InvestmentPortfolioSummary;
  plans: WalletPlan[];
  /** Typical monthly contribution, used to suggest where the next one goes. */
  monthlyContribution: number;
  /** What the recurring templates put into each account in a month. */
  fundingNeeds: WalletFundingNeed[];
}

type AllocationView = "total" | "monthly";

/**
 * How the portfolio is split across accounts, against the split the reader
 * chose.
 *
 * Every row says it in words and in euros: a share today, a share aimed for,
 * and how many euros above or below that the account sits. Drift used to be
 * shown in percentage points with a colour for its sign, which answered a
 * question nobody asks. The bar under each row is the same fact drawn, the
 * share filled and the target marked, so the page reads at a glance.
 *
 * The bars are all investment cyan: every one of them is investment money,
 * and the label beside each says which account it is.
 *
 * The Monthly view asks the same question of the standing orders instead of
 * the balances: of what the recurring templates put in each month, what share
 * goes to each account, against the same targets. `buildAllocation` answers
 * both, handed values in one case and monthly amounts in the other, so a gap
 * in that view is euros a month.
 */
export function AllocationCard({
  portfolio,
  plans,
  monthlyContribution,
  fundingNeeds,
}: AllocationCardProps) {
  const t = useT();
  const formatEuro = useFormatCurrency();
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [view, setView] = useState<AllocationView>("total");
  const [pending, startTransition] = useTransition();

  const targets: WalletTarget[] = useMemo(() => {
    const byWallet = new Map(plans.map((plan) => [plan.wallet, plan]));
    return portfolio.columns.map((column) => {
      const weight = byWallet.get(column.walletId)?.target_weight;
      return {
        walletId: column.walletId,
        targetWeight:
          weight === null || weight === undefined ? null : Number(weight),
      };
    });
  }, [portfolio.columns, plans]);

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

  const monthly = useMemo(
    () =>
      buildAllocation(
        fundingNeeds.map((need) => ({
          walletId: need.walletId,
          value: need.monthlyTotal,
        })),
        targets,
      ),
    [fundingNeeds, targets],
  );

  const split = useMemo(
    () => suggestContributionSplit(allocation, monthlyContribution),
    [allocation, monthlyContribution],
  );

  // Any target saved at all, even a set that no longer adds up: the reset
  // has to be reachable from exactly the state it exists to get out of.
  const targetsSaved = allocation.targetCoverage > 0;
  const targetsMeasured = allocation.rows.some(
    (row) => row.targetWeight !== null,
  );
  const shown = allocation.rows.filter(
    (row) => row.value > 0 || (row.targetWeight ?? 0) > 0,
  );
  const monthlyShown = monthly.rows.filter(
    (row) => row.value > 0 || (row.targetWeight ?? 0) > 0,
  );

  function save(percents: Record<InvestmentWalletId, number>) {
    startTransition(async () => {
      const result = await saveWalletTargets(
        allocation.rows.map((row) => ({
          wallet: row.walletId,
          targetWeight: percents[row.walletId] / 100,
        })),
      );
      if (result.error) {
        toast(result.error, "error");
        return;
      }
      toast(t("position.targetsSaved"), "success");
      setEditing(false);
    });
  }

  function remove() {
    startTransition(async () => {
      const result = await clearWalletTargets();
      if (result.error) {
        toast(result.error, "error");
        return;
      }
      toast(t("position.targetsRemoved"), "success");
      setEditing(false);
    });
  }

  return (
    <Card.Bezel className="w-full" innerClassName="p-5 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-head text-base">{t("position.allocation")}</h2>
        {editing ? null : (
          <div className="flex flex-wrap items-center gap-2">
            {/* Toggles rather than tabs, as on Charges: `aria-pressed` says
                which view is showing and claims no arrow-key handling. */}
            <div
              role="group"
              aria-label={t("position.allocationView")}
              className="flex rounded-full border border-border p-0.5 text-xs"
            >
              {(["total", "monthly"] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  aria-pressed={view === option}
                  onClick={() => setView(option)}
                  className={cn(
                    "min-h-11 rounded-full px-3 font-medium lg:min-h-8",
                    "transition-colors duration-hover",
                    view === option
                      ? "bg-foreground text-background"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {option === "total"
                    ? t("position.viewTotal")
                    : t("position.viewMonthly")}
                </button>
              ))}
            </div>
            <Button variant="link" size="sm" onClick={() => setEditing(true)}>
              <PencilSimple size={ICON.sm} className="mr-1 inline" />
              {targetsSaved
                ? t("position.editTargets")
                : t("position.setTargets")}
            </Button>
          </div>
        )}
      </div>

      {editing ? (
        <TargetEditor
          rows={allocation.rows}
          initial={
            targetsMeasured
              ? (Object.fromEntries(
                  allocation.rows.map((row) => [
                    row.walletId,
                    Math.round((row.targetWeight ?? 0) * 100),
                  ]),
                ) as Record<InvestmentWalletId, number>)
              : currentSplitPercents(allocation)
          }
          current={currentSplitPercents(allocation)}
          pending={pending}
          canRemove={targetsSaved}
          onSave={save}
          onRemove={remove}
          onCancel={() => setEditing(false)}
        />
      ) : view === "monthly" ? (
        monthly.total > 0 ? (
          <>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("position.monthlyIntroBefore")}{" "}
              <span className="privacy-amount tabular-nums text-foreground">
                {formatEuro(monthly.total)}
              </span>{" "}
              {t("position.monthlyIntroAfter")}
            </p>

            <ul className="mt-4 flex flex-col gap-4">
              {monthlyShown.map((row) => (
                <AllocationRowItem key={row.walletId} row={row} monthly />
              ))}
            </ul>

            {targetsMeasured && !monthly.needsRebalance ? (
              <p className="mt-4 border-t border-border pt-4 text-sm text-muted-foreground">
                {t("position.monthlyOnTarget")}
              </p>
            ) : null}

            {targetsMeasured ? null : (
              <p className="mt-4 border-t border-border pt-4 text-sm text-muted-foreground">
                {t("position.noTargetHint")}
              </p>
            )}
          </>
        ) : (
          <p className="mt-4 text-sm text-muted-foreground">
            {t("position.monthlyNothing")}
          </p>
        )
      ) : (
        <>
          <p className="mt-1 text-sm text-muted-foreground">
            {targetsMeasured
              ? t("position.allocationIntroTargets")
              : t("position.allocationIntro")}
          </p>

          <ul className="mt-4 flex flex-col gap-4">
            {shown.map((row) => (
              <AllocationRowItem key={row.walletId} row={row} />
            ))}
          </ul>

          {targetsMeasured && allocation.needsRebalance && split.length > 0 ? (
            <div className="mt-4 flex flex-col gap-2 border-t border-border pt-4 text-sm">
              <p className="text-muted-foreground">
                {t("position.nextContributionBefore")}{" "}
                <span className="privacy-amount tabular-nums text-foreground">
                  {formatEuro(monthlyContribution)}
                </span>{" "}
                {t("position.nextContributionAfter")}
              </p>
              <ul className="flex flex-wrap gap-x-5 gap-y-1">
                {split.map((row) => (
                  <li key={row.walletId}>
                    <span className="privacy-amount font-medium tabular-nums">
                      {formatEuro(row.amount)}
                    </span>{" "}
                    {t("position.splitItemTo", {
                      wallet: INVESTMENT_WALLET_LABELS[row.walletId],
                    })}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {targetsMeasured && !allocation.needsRebalance ? (
            <p className="mt-4 border-t border-border pt-4 text-sm text-muted-foreground">
              {t("position.allOnTarget")}
            </p>
          ) : null}

          {targetsMeasured ? null : (
            <p className="mt-4 border-t border-border pt-4 text-sm text-muted-foreground">
              {t("position.noTargetHint")}
            </p>
          )}
        </>
      )}
    </Card.Bezel>
  );
}

/**
 * One account: its value, its share drawn, and where it stands in words.
 * `monthly` reads the same row as a month of contributions rather than a
 * balance, so every amount on it is per month.
 */
function AllocationRowItem({
  row,
  monthly = false,
}: {
  row: AllocationRow;
  monthly?: boolean;
}) {
  const t = useT();
  const formatEuro = useFormatCurrency();
  const share = formatWeight(row.currentWeight);
  const target = formatWeight(row.targetWeight);
  const perMonth = monthly ? (
    <span className="text-xs text-muted-foreground">
      {t("charges.perMonthSuffix")}
    </span>
  ) : null;

  return (
    <li className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="font-medium">
          {INVESTMENT_WALLET_LABELS[row.walletId]}
        </span>
        <span className="privacy-amount tabular-nums">
          {formatEuro(row.value)}
          {perMonth}
        </span>
      </div>

      {/* The line below says the same in words, so this is hidden from
          screen readers. */}
      <div
        aria-hidden="true"
        className="relative h-2 w-full rounded-full bg-muted"
      >
        <span
          className="absolute inset-y-0 left-0 rounded-full bg-info"
          style={{ width: `${row.currentWeight * 100}%` }}
        />
        {row.targetWeight !== null ? (
          <span
            className="absolute -inset-y-1 w-0.5 rounded-full bg-foreground"
            style={{ left: `calc(${row.targetWeight * 100}% - 1px)` }}
          />
        ) : null}
      </div>

      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-xs">
        <span className="text-muted-foreground">
          {monthly
            ? row.value === 0
              ? t("position.monthlyNoneTarget", { target })
              : row.targetWeight === null
                ? t("position.shareOfEachMonth", { share })
                : t("position.shareOfEachMonthTarget", { share, target })
            : row.targetWeight === null
              ? t("position.shareOfInvestments", { share })
              : t("position.shareNowTarget", { share, target })}
        </span>
        {row.status === "on-target" ? (
          <span className="text-muted-foreground">
            {t("position.onTarget")}
          </span>
        ) : row.status === "over" || row.status === "under" ? (
          <span>
            <span className="privacy-amount tabular-nums">
              {formatEuro(Math.abs(row.gap ?? 0))}
              {perMonth}
            </span>{" "}
            {row.status === "over"
              ? t("position.aboveTarget")
              : t("position.belowTarget")}
          </span>
        ) : null}
      </div>
    </li>
  );
}

/**
 * The target split, one whole percentage per account.
 *
 * Starts from the saved targets, or from today's split when there are none,
 * so the first edit is a nudge rather than five blank boxes. The running
 * total says what is left to assign instead of only refusing to save.
 */
function TargetEditor({
  rows,
  initial,
  current,
  pending,
  canRemove,
  onSave,
  onRemove,
  onCancel,
}: {
  rows: AllocationRow[];
  initial: Record<InvestmentWalletId, number>;
  current: Record<InvestmentWalletId, number>;
  pending: boolean;
  canRemove: boolean;
  onSave: (percents: Record<InvestmentWalletId, number>) => void;
  onRemove: () => void;
  onCancel: () => void;
}) {
  const t = useT();
  const [draft, setDraft] = useState<Record<InvestmentWalletId, string>>(() =>
    toDraft(initial),
  );

  const percents = Object.fromEntries(
    rows.map((row) => [row.walletId, readPercent(draft[row.walletId])]),
  ) as Record<InvestmentWalletId, number>;
  const total = Object.values(percents).reduce((sum, value) => sum + value, 0);

  return (
    <div className="mt-2 flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        {t("position.targetEditorIntro")}
      </p>

      <div className="flex flex-col gap-2">
        {rows.map((row) => (
          <label
            key={row.walletId}
            className="flex items-center justify-between gap-3 text-sm"
          >
            <span className="flex items-baseline gap-2">
              <span className="font-medium">
                {INVESTMENT_WALLET_LABELS[row.walletId]}
              </span>
              <span className="text-xs text-muted-foreground">
                {t("position.targetNow", {
                  share: formatWeight(row.currentWeight),
                })}
              </span>
            </span>
            <span className="flex items-center gap-2">
              <input
                type="number"
                inputMode="numeric"
                min={0}
                max={100}
                step={1}
                value={draft[row.walletId]}
                onChange={(event) =>
                  setDraft((previous) => ({
                    ...previous,
                    [row.walletId]: event.target.value,
                  }))
                }
                className="h-10 min-h-11 lg:min-h-0 w-20 rounded-control border border-border bg-background px-2 text-right tabular-nums"
              />
              <span className="text-muted-foreground">%</span>
            </span>
          </label>
        ))}
      </div>

      <p
        aria-live="polite"
        className={cn(
          "text-sm tabular-nums",
          total === 100 ? "text-muted-foreground" : "text-foreground",
        )}
      >
        {total === 100
          ? t("position.targetTotalComplete")
          : total < 100
            ? t("position.targetTotalShort", { left: 100 - total })
            : t("position.targetTotalOver", { over: total - 100 })}
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          disabled={pending || total !== 100}
          onClick={() => onSave(percents)}
        >
          {pending ? t("position.saving") : t("position.saveTargets")}
        </Button>
        <Button
          variant="outline"
          disabled={pending}
          onClick={() => setDraft(toDraft(current))}
        >
          {t("position.useCurrentSplit")}
        </Button>
        <Button variant="outline" disabled={pending} onClick={onCancel}>
          {t("position.cancel")}
        </Button>
        {canRemove ? (
          <Button
            variant="link"
            className="text-destructive"
            disabled={pending}
            onClick={onRemove}
          >
            <Trash size={ICON.md} weight="light" className="mr-1.5" />
            {t("position.removeTargets")}
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function toDraft(
  percents: Record<InvestmentWalletId, number>,
): Record<InvestmentWalletId, string> {
  return Object.fromEntries(
    Object.entries(percents).map(([walletId, value]) => [
      walletId,
      String(value),
    ]),
  ) as Record<InvestmentWalletId, string>;
}

/** An empty or unreadable box counts as 0, and a share stays within 0–100. */
function readPercent(value: string | undefined): number {
  const parsed = Math.round(Number(value));
  return Number.isFinite(parsed) ? Math.min(100, Math.max(0, parsed)) : 0;
}

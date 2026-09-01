import { useMemo, useState } from "react";
import { Pressable, View } from "react-native";

import {
  buildAllocation,
  formatWeight,
  suggestContributionSplit,
  type WalletTarget,
} from "@finance/core/allocation";
import { todayIsoLocal } from "@finance/core/constants";
import { INVESTMENT_WALLET_LABELS } from "@finance/core/investments";
import type { InvestmentPortfolioSummary } from "@finance/core/investment-positions";
import { buildPeaStatus, peaMaturityHint } from "@finance/core/pea";
import type { InvestmentReturns } from "@finance/core/investment-returns";
import { formatAnnualRate } from "@finance/core/xirr";
import type { WalletPlan } from "@finance/core/types/database";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { DateField } from "@/components/ui/DateField";
import { Input } from "@/components/ui/Input";
import { PrivateAmount } from "@/components/PrivateAmount";
import { Text } from "@/components/ui/Text";
import { cn } from "@/lib/cn";
import { saveWalletPlan, saveWalletTargets } from "@/lib/mutations";
import { useFormatCurrency } from "@/providers/CurrencyProvider";
import { useToast } from "@/providers/ToastProvider";
import { useThemeColors } from "@/theme/useThemeColors";

interface WalletPlanPanelProps {
  portfolio: InvestmentPortfolioSummary;
  returns: InvestmentReturns | null;
  plans: WalletPlan[];
  /** Typical monthly contribution, so the split is in real money. */
  monthlyContribution: number;
  onSaved: () => void;
}

/**
 * The part of Wallets that says what to do, rather than what is.
 *
 * Mirrors the web panel: how far the split has drifted from what the user
 * intended, where the next contribution should go to close the gap without
 * selling anything, and — for a PEA — the room left under the ceiling and the
 * five-year clock.
 */
export function WalletPlanPanel({
  portfolio,
  returns,
  plans,
  monthlyContribution,
  onSaved,
}: WalletPlanPanelProps) {
  const formatEuro = useFormatCurrency();
  const colors = useThemeColors();
  const [editing, setEditing] = useState(false);

  const planByWallet = useMemo(
    () => new Map(plans.map((plan) => [plan.wallet, plan])),
    [plans],
  );

  const targets: WalletTarget[] = useMemo(
    () =>
      portfolio.columns.map((column) => {
        const weight = planByWallet.get(column.walletId)?.target_weight;
        return {
          walletId: column.walletId,
          targetWeight:
            weight === null || weight === undefined ? null : Number(weight),
        };
      }),
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
    () => new Map((returns?.wallets ?? []).map((row) => [row.walletId, row])),
    [returns],
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

  return (
    <>
      <Card bezel innerClassName="gap-3 p-4">
        <View className="flex-row items-center justify-between">
          <Text className="font-bold">Allocation</Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => setEditing((value) => !value)}
            hitSlop={8}
          >
            <Text className="text-sm font-medium text-primary-ink">
              {editing ? "Cancel" : "Set targets"}
            </Text>
          </Pressable>
        </View>

        {editing ? (
          <TargetEditor
            initial={targets}
            onSaved={() => {
              setEditing(false);
              onSaved();
            }}
          />
        ) : (
          <View className="gap-3">
            {allocation.rows.map((row) => {
              const rate = formatAnnualRate(
                returnByWallet.get(row.walletId)?.rate ?? null,
              );

              return (
                <View key={row.walletId} className="gap-1.5">
                  <View className="flex-row items-baseline justify-between gap-3">
                    <Text className="text-sm font-medium">
                      {INVESTMENT_WALLET_LABELS[row.walletId]}
                    </Text>
                    <PrivateAmount className="font-mono text-sm">
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
                        borderRadius: 999,
                        backgroundColor: colors.primary,
                        width: `${Math.round(row.currentWeight * 100)}%`,
                      }}
                    />
                  </View>

                  <View className="flex-row flex-wrap items-center justify-between gap-x-3">
                    <Text variant="muted" className="text-xs">
                      {formatWeight(row.currentWeight)}
                      {row.targetWeight !== null
                        ? ` of ${formatWeight(row.targetWeight)} target`
                        : ""}
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
                        {`${row.status === "over" ? "+" : ""}${Math.round(
                          row.driftPoints ?? 0,
                        )} pts`}
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
              {`Your next ${formatEuro(monthlyContribution)} would close the gap fastest as `}
              {split.map((row, index) => (
                <Text key={row.walletId} className="text-sm">
                  {index > 0 ? ", " : ""}
                  <Text className="font-mono font-semibold text-foreground">
                    {formatEuro(row.amount)}
                  </Text>
                  {` to ${INVESTMENT_WALLET_LABELS[row.walletId]}`}
                </Text>
              ))}
              {" — rebalancing by contribution rather than by selling."}
            </Text>
          </View>
        ) : null}

        {!editing && allocation.targetCoverage === 0 ? (
          <Text variant="muted" className="border-t border-border pt-3 text-sm">
            Set a target split to see how far the portfolio has drifted, and
            where the next contribution should go.
          </Text>
        ) : null}
      </Card>

      {peaStatus ? (
        <Card bezel innerClassName="gap-3 p-4">
          <Text className="font-bold">PEA</Text>

          <View className="flex-row flex-wrap items-baseline justify-between gap-2">
            <Text variant="muted" className="text-sm">
              {"Paid in "}
              <PrivateAmount className="font-mono text-sm text-foreground">
                {formatEuro(peaStatus.contributed)}
              </PrivateAmount>
              {` of ${formatEuro(peaStatus.ceiling)}`}
            </Text>
            <Text
              className={cn(
                "font-mono text-sm",
                peaStatus.nearCeiling
                  ? "text-destructive"
                  : "text-muted-foreground",
              )}
            >
              {`${formatEuro(peaStatus.headroom)} left`}
            </Text>
          </View>

          <View
            className="h-2 w-full overflow-hidden rounded-full"
            style={{ backgroundColor: colors.muted }}
          >
            <View
              style={{
                height: "100%",
                borderRadius: 999,
                backgroundColor: peaStatus.nearCeiling
                  ? colors.destructive
                  : colors.primary,
                width: `${Math.min(100, Math.round(peaStatus.ratio * 100))}%`,
              }}
            />
          </View>

          <Text variant="muted" className="text-xs">
            Only cash paid in counts against the ceiling — growth does not.
          </Text>

          <PeaOpenedField
            openedOn={peaPlan?.opened_on ?? null}
            hint={peaMaturityHint(peaStatus)}
            onSaved={onSaved}
          />
        </Card>
      ) : null}
    </>
  );
}

function TargetEditor({
  initial,
  onSaved,
}: {
  initial: WalletTarget[];
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const [pending, setPending] = useState(false);
  const [draft, setDraft] = useState(() =>
    initial.map((target) => ({
      walletId: target.walletId,
      percent: String(Math.round((target.targetWeight ?? 0) * 100)),
    })),
  );

  const total = draft.reduce((sum, row) => sum + (Number(row.percent) || 0), 0);

  async function save() {
    setPending(true);
    const result = await saveWalletTargets(
      draft.map((row) => ({
        wallet: row.walletId,
        targetWeight: (Number(row.percent) || 0) / 100,
      })),
    );
    setPending(false);

    if (result.error) {
      toast(result.error, "error");
      return;
    }
    toast("Targets saved", "success");
    onSaved();
  }

  return (
    <View className="gap-3">
      {draft.map((row) => (
        <View
          key={row.walletId}
          className="flex-row items-center justify-between gap-3"
        >
          <Text className="text-sm">
            {INVESTMENT_WALLET_LABELS[row.walletId]}
          </Text>
          <View className="w-24 flex-row items-center gap-2">
            <Input
              value={row.percent}
              onChangeText={(value) =>
                setDraft((current) =>
                  current.map((item) =>
                    item.walletId === row.walletId
                      ? { ...item, percent: value.replace(/[^0-9]/g, "") }
                      : item,
                  ),
                )
              }
              keyboardType="number-pad"
              accessibilityLabel={`${INVESTMENT_WALLET_LABELS[row.walletId]} target percent`}
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
          "font-mono text-sm",
          total === 100 ? "text-muted-foreground" : "text-destructive",
        )}
      >
        {`${total}% allocated${total === 100 ? "" : " — must total 100%"}`}
      </Text>

      <Button
        label={pending ? "Saving…" : "Save targets"}
        disabled={pending || total !== 100}
        onPress={() => void save()}
      />
    </View>
  );
}

/** The one date that starts a PEA's five-year clock. */
function PeaOpenedField({
  openedOn,
  hint,
  onSaved,
}: {
  openedOn: string | null;
  hint: string | null;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const [value, setValue] = useState(openedOn ?? todayIsoLocal());
  const [editing, setEditing] = useState(false);
  const [pending, setPending] = useState(false);

  async function save() {
    setPending(true);
    const result = await saveWalletPlan({ wallet: "pea", openedOn: value });
    setPending(false);

    if (result.error) {
      toast(result.error, "error");
      return;
    }
    toast("Saved", "success");
    setEditing(false);
    onSaved();
  }

  return (
    <View className="gap-2 border-t border-border pt-3">
      {editing ? (
        <>
          <Text className="text-sm font-medium">Opened on</Text>
          <DateField value={value} onChange={setValue} />
          <View className="flex-row gap-2">
            <Button
              label={pending ? "Saving…" : "Save"}
              size="sm"
              className="flex-1"
              disabled={pending}
              onPress={() => void save()}
            />
            <Button
              label="Cancel"
              variant="outline"
              size="sm"
              className="flex-1"
              disabled={pending}
              onPress={() => setEditing(false)}
            />
          </View>
        </>
      ) : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Set the date the PEA was opened"
          onPress={() => setEditing(true)}
        >
          <Text variant="muted" className="text-sm">
            {hint ?? "Add the opening date to track the five-year mark."}
            <Text className="text-sm font-medium text-primary-ink">
              {openedOn ? "  Change" : "  Add"}
            </Text>
          </Text>
        </Pressable>
      )}
    </View>
  );
}

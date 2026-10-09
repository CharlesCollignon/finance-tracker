import { useMemo, useState } from "react";
import { Pressable, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { formatPercentLabel } from "@finance/core/constants";
import {
  ENVELOPE_NAME_KEYS,
  ENVELOPE_ORDER,
  ENVELOPE_PRESETS,
  ENVELOPE_SHORT_KEYS,
  ENVELOPE_TAX_KEYS,
  projectEnvelopes,
  type Envelope,
  type EnvelopeId,
} from "@finance/core/future-plan";
import type { Translate } from "@finance/core/i18n/t";

import { AnimatedAmount } from "@/components/AnimatedAmount";
import { PrivateAmount } from "@/components/PrivateAmount";
import { Button } from "@/components/ui/Button";
import { Text } from "@/components/ui/Text";
import { hapticLight } from "@/lib/haptics";
import type { PlanSettings } from "@/lib/plan-future-data";
import { useLocale, useT } from "@/providers/LocaleProvider";
import { ICON, TYPE } from "@/theme/tokens";
import { useThemeColors } from "@/theme/useThemeColors";

import { AccountsBreakdown } from "./AccountsBreakdown";
import { NumberField, Stepper } from "./Fields";
import { usePlanMoney } from "./format";
import { PlanCard } from "./PlanCard";
import { LAYER_COLORS, YearsChart } from "./YearsChart";
import { isSavingsKind } from "@finance/core/savings-accounts";

export const MAX_YEARS = 40;

export function envelopeName(id: EnvelopeId, t: Translate): string {
  return t(ENVELOPE_SHORT_KEYS[id]);
}

/** Half a point at a time, kept to one decimal so 2.5% never reads 2.4999%. */
function stepRate(value: number, delta: number, min: number, max: number) {
  return Math.min(
    max,
    Math.max(min, Math.round((value + delta) * 1000) / 1000),
  );
}

/**
 * The long view, after French tax: what the accounts could be worth in N
 * years at the returns the user expects, what that is in today's euros, and
 * the income it could pay. The result comes first, then the knobs —
 * prefilled from the user's own figures and remembered once changed.
 */
export function LongViewCard({
  settings,
  envelopes,
  declaredSavings,
  custom,
  onSettingsChange,
  onEnvelopesChange,
  onReset,
}: {
  settings: PlanSettings;
  /** The accounts in use: the user's figures, or their edits. */
  envelopes: Envelope[];
  /**
   * Whether the user has declared savings accounts on Placements, in which
   * case everything-saved-in-one is not offered beside them.
   */
  declaredSavings: boolean;
  /** Whether the accounts are edited rather than read from the data. */
  custom: boolean;
  onSettingsChange: (patch: Partial<Omit<PlanSettings, "envelopes">>) => void;
  onEnvelopesChange: (envelopes: Envelope[]) => void;
  onReset: () => void;
}) {
  const t = useT();
  const locale = useLocale();
  const colors = useThemeColors();
  const { whole, shown } = usePlanMoney();
  const [adding, setAdding] = useState(false);
  const [incomeHint, setIncomeHint] = useState(false);
  // The year under the finger on the chart, which the breakdown follows.
  const [activeYear, setActiveYear] = useState<number | null>(null);

  const { years, inflation, withdrawalRate } = settings;
  const result = useMemo(
    () => projectEnvelopes({ envelopes, years, inflation, withdrawalRate }),
    [envelopes, years, inflation, withdrawalRate],
  );

  const hasSavingsKind = envelopes.some((envelope) =>
    isSavingsKind(envelope.id),
  );
  const missing = ENVELOPE_ORDER.filter(
    (id) =>
      !envelopes.some((envelope) => envelope.id === id) &&
      // Everything saved in one only stands in when no account is named.
      !(id === "savings" && (declaredSavings || hasSavingsKind)),
  );
  const shares =
    activeYear !== null && result.years[activeYear]
      ? result.years[activeYear].accounts
      : result.accounts;

  const update = (index: number, patch: Partial<Envelope>) =>
    onEnvelopesChange(
      envelopes.map((envelope, at) =>
        at === index ? { ...envelope, ...patch } : envelope,
      ),
    );

  return (
    <PlanCard>
      <View className="gap-1">
        <Text accessibilityRole="header" className="text-sm font-medium">
          {t("futurePlan.longTitle", { count: years })}
        </Text>
        <View className="flex-row flex-wrap items-baseline gap-x-2">
          <AnimatedAmount
            value={result.netValue}
            format={whole}
            startFrom={0}
            style={[TYPE.hero, { fontSize: 36 }]}
            numberOfLines={1}
            adjustsFontSizeToFit
          />
          <Text variant="muted" className="text-sm">
            {t("futurePlan.longNet")}
          </Text>
        </View>
        <Text variant="muted" className="text-sm">
          {t("futurePlan.longReal", { amount: shown(result.realNetValue) })}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ expanded: incomeHint }}
          onPress={() => {
            void hapticLight();
            setIncomeHint((open) => !open);
          }}
          className="min-h-11 flex-row items-center gap-1.5 self-start"
        >
          <Ionicons
            name="sunny-outline"
            size={ICON.md}
            color={colors.foreground}
          />
          <Text className="shrink text-sm font-medium">
            {t("futurePlan.longIncome", {
              amount: shown(result.monthlyIncome),
            })}
          </Text>
          <Ionicons
            name="information-circle-outline"
            size={ICON.sm}
            color={colors.mutedForeground}
          />
        </Pressable>
        {incomeHint ? (
          <Text variant="muted" className="text-xs">
            {t("futurePlan.longIncomeHint")}
          </Text>
        ) : null}
        <AccountsBreakdown
          shares={shares}
          horizon={result.accounts}
          money={shown}
        />
      </View>

      <View className="flex-row flex-wrap gap-x-4 gap-y-1">
        {(
          [
            ["futurePlan.legendInitial", LAYER_COLORS.initial],
            ["futurePlan.legendContributions", LAYER_COLORS.contributions],
            ["futurePlan.legendGains", LAYER_COLORS.gains],
          ] as const
        ).map(([key, color]) => (
          <View key={key} className="flex-row items-center gap-1.5">
            <View
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: color }}
            />
            <Text variant="muted" className="text-xs">
              {t(key)}
            </Text>
          </View>
        ))}
      </View>

      <YearsChart
        years={result.years}
        money={shown}
        label={t("futurePlan.longTitle", { count: years })}
        onActiveChange={setActiveYear}
      />

      <View className="flex-row flex-wrap gap-2">
        {(
          [
            ["futurePlan.statFuture", result.futureValue],
            ["futurePlan.statGains", result.gains],
            ["futurePlan.statTaxes", result.taxes],
            ["futurePlan.statNet", result.netValue],
          ] as const
        ).map(([key, value]) => (
          <View
            key={key}
            className="min-w-[45%] flex-1 gap-0.5 rounded-control border border-border px-3 py-2.5"
          >
            <Text variant="muted" className="text-xs">
              {t(key)}
            </Text>
            <PrivateAmount className="text-base font-semibold">
              {whole(value)}
            </PrivateAmount>
          </View>
        ))}
      </View>

      <View className="gap-4 border-t border-border pt-4">
        <Stepper
          label={t("futurePlan.horizon")}
          valueText={t("futurePlan.years", { count: years })}
          canDecrease={years > 1}
          canIncrease={years < MAX_YEARS}
          onDecrease={() => onSettingsChange({ years: years - 1 })}
          onIncrease={() => onSettingsChange({ years: years + 1 })}
        />
        <Stepper
          label={t("futurePlan.inflation")}
          valueText={formatPercentLabel(inflation * 100, locale)}
          hint={t("futurePlan.inflationHint")}
          canDecrease={inflation > 0}
          canIncrease={inflation < 0.1}
          onDecrease={() =>
            onSettingsChange({ inflation: stepRate(inflation, -0.005, 0, 0.1) })
          }
          onIncrease={() =>
            onSettingsChange({ inflation: stepRate(inflation, 0.005, 0, 0.1) })
          }
        />
        <Stepper
          label={t("futurePlan.withdrawalRate")}
          valueText={formatPercentLabel(withdrawalRate * 100, locale)}
          hint={t("futurePlan.withdrawalHint")}
          canDecrease={withdrawalRate > 0.01}
          canIncrease={withdrawalRate < 0.1}
          onDecrease={() =>
            onSettingsChange({
              withdrawalRate: stepRate(withdrawalRate, -0.005, 0.01, 0.1),
            })
          }
          onIncrease={() =>
            onSettingsChange({
              withdrawalRate: stepRate(withdrawalRate, 0.005, 0.01, 0.1),
            })
          }
        />
      </View>

      <View className="gap-3 border-t border-border pt-4">
        <View className="gap-0.5">
          <Text accessibilityRole="header" className="font-semibold">
            {t("futurePlan.accountsTitle")}
          </Text>
          <Text variant="muted" className="text-xs">
            {t("futurePlan.accountsFromData")}
          </Text>
        </View>

        {envelopes.map((envelope, index) => (
          <AccountRow
            key={envelope.id}
            envelope={envelope}
            onChange={(patch) => update(index, patch)}
            onRemove={() =>
              onEnvelopesChange(envelopes.filter((_, at) => at !== index))
            }
          />
        ))}

        {missing.length > 0 ? (
          adding ? (
            <View className="gap-2">
              <Text variant="muted" className="text-xs">
                {t("planPhone.accountPick")}
              </Text>
              <View className="flex-row flex-wrap gap-2">
                {missing.map((id) => (
                  <Pressable
                    key={id}
                    accessibilityRole="button"
                    onPress={() => {
                      void hapticLight();
                      setAdding(false);
                      onEnvelopesChange(
                        [
                          ...envelopes,
                          {
                            id,
                            initial: 0,
                            monthly: 0,
                            annualReturn: ENVELOPE_PRESETS[id].annualReturn,
                            taxOnGains: ENVELOPE_PRESETS[id].taxOnGains,
                          },
                        ].sort(
                          (left, right) =>
                            ENVELOPE_ORDER.indexOf(left.id) -
                            ENVELOPE_ORDER.indexOf(right.id),
                        ),
                      );
                    }}
                    className="min-h-12 justify-center rounded-full border border-border px-4"
                  >
                    <Text className="text-sm font-medium">
                      {envelopeName(id, t)}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          ) : (
            <Button
              label={t("futurePlan.accountAdd")}
              variant="outline"
              size="md"
              className="self-start"
              onPress={() => setAdding(true)}
            />
          )
        ) : null}

        {custom ? (
          <Button
            label={t("futurePlan.accountsReset")}
            variant="ghost"
            size="md"
            className="self-start"
            onPress={() => {
              setAdding(false);
              onReset();
            }}
          />
        ) : null}
      </View>

      <View className="gap-0.5">
        <Text variant="micro">{t("futurePlan.estimate")}</Text>
        <Text variant="micro">{t("futurePlan.taxSource")}</Text>
      </View>
    </PlanCard>
  );
}

function AccountRow({
  envelope,
  onChange,
  onRemove,
}: {
  envelope: Envelope;
  onChange: (patch: Partial<Envelope>) => void;
  onRemove: () => void;
}) {
  const t = useT();
  const colors = useThemeColors();
  const name = envelopeName(envelope.id, t);
  const fullName = t(ENVELOPE_NAME_KEYS[envelope.id]);

  // Livrets and PELs charge no fees; a wallet's funds and envelope do.
  const charges = envelope.id !== "savings" && !isSavingsKind(envelope.id);

  return (
    <View className="gap-3 rounded-card border border-border p-3">
      <View className="flex-row items-start justify-between gap-2">
        <View className="min-w-0 flex-1 pt-1">
          <Text className="font-semibold">{name}</Text>
          {fullName !== name ? (
            <Text variant="muted" className="text-xs">
              {fullName}
            </Text>
          ) : null}
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("futurePlan.accountRemove", { name })}
          onPress={() => {
            void hapticLight();
            onRemove();
          }}
          className="-mr-1 -mt-1 h-12 w-12 items-center justify-center"
        >
          <Ionicons
            name="close"
            size={ICON.lg}
            color={colors.mutedForeground}
          />
        </Pressable>
      </View>

      <View className="flex-row gap-2">
        <NumberField
          label={t("futurePlan.fieldInitial")}
          kind="money"
          value={envelope.initial}
          onChange={(initial) => onChange({ initial })}
        />
        <NumberField
          label={t("futurePlan.fieldMonthly")}
          kind="money"
          value={envelope.monthly}
          onChange={(monthly) => onChange({ monthly })}
        />
      </View>
      <View className="flex-row gap-2">
        <NumberField
          label={t("futurePlan.fieldReturn")}
          kind="percent"
          value={envelope.annualReturn}
          min={-0.5}
          max={0.5}
          onChange={(annualReturn) => onChange({ annualReturn })}
        />
        {/* Livrets charge nothing; a fund and its envelope do. */}
        {charges ? (
          <NumberField
            label={t("futurePlan.fieldFees")}
            kind="percent"
            decimals={2}
            value={envelope.fees ?? 0}
            max={0.05}
            onChange={(fees) => onChange({ fees })}
          />
        ) : (
          <NumberField
            label={t("futurePlan.fieldTax")}
            kind="percent"
            value={envelope.taxOnGains}
            max={1}
            onChange={(taxOnGains) => onChange({ taxOnGains })}
          />
        )}
      </View>
      {charges ? (
        <View className="flex-row gap-2">
          <NumberField
            label={t("futurePlan.fieldTax")}
            kind="percent"
            value={envelope.taxOnGains}
            max={1}
            onChange={(taxOnGains) => onChange({ taxOnGains })}
          />
          <View className="flex-1" />
        </View>
      ) : null}

      <Text variant="muted" className="text-xs">
        {t(ENVELOPE_TAX_KEYS[envelope.id])}
      </Text>
    </View>
  );
}

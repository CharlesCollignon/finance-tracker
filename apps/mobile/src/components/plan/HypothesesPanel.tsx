import { useMemo, useState } from "react";
import { Linking, Pressable, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { formatPercentLabel } from "@finance/core/constants";
import {
  ENVELOPE_NAME_KEYS,
  ENVELOPE_SHORT_KEYS,
  ENVELOPE_TAX_KEYS,
  type Envelope,
} from "@finance/core/future-plan";
import type { WalletMix } from "@finance/core/history/mix";
import { historyReturnFor } from "@finance/core/history/plan-accounts";
import type {
  EnvelopeEdit,
  HypothesesEdits,
} from "@finance/core/history/plan-settings";
import { HISTORY_END, HISTORY_START } from "@finance/core/history/series";
import { HISTORY_SOURCES } from "@finance/core/history/sources";
import { resolveMessage } from "@finance/core/i18n/t";
import type { InvestmentWalletId } from "@finance/core/investments";
import { DEFAULT_PROPERTY_GROWTH } from "@finance/core/property-future";
import { isSavingsKind } from "@finance/core/savings-accounts";
import type { PropertyRead } from "@finance/data/properties";

import { Card } from "@/components/ui/Card";
import { Text } from "@/components/ui/Text";
import { hapticSelection } from "@/lib/haptics";
import { setGrowth } from "@/lib/properties";
import { useLocale, useT } from "@/providers/LocaleProvider";
import { useToast } from "@/providers/ToastProvider";
import { ICON } from "@/theme/tokens";
import { useThemeColors } from "@/theme/useThemeColors";

import { NumberField } from "./Fields";

/**
 * « Hypothèses », folded, as on the web: each account's figures as the
 * trajectory reads them, every one of them the reader's to change. The
 * return starts at what the account's history returned; a change moves that
 * whole history, its falls kept. Below, where the history comes from and on
 * what terms.
 *
 * The milestones and « Face à l'histoire » never read these: they are about
 * money that exists and markets as they were. A home's yearly growth is the
 * one figure kept for the account, as its own screen keeps it.
 */
export function HypothesesPanel({
  envelopes,
  edited,
  edits,
  wallets,
  onEdits,
  properties,
  onGrowthKept,
}: {
  /** The reader's own figures. */
  envelopes: readonly Envelope[];
  /** The same with the edits laid over. */
  edited: readonly Envelope[];
  edits: HypothesesEdits;
  wallets: Partial<Record<InvestmentWalletId, WalletMix>>;
  onEdits: (edits: HypothesesEdits) => void;
  /** The homes, whose yearly growth « Avec vos biens » reads. */
  properties: readonly PropertyRead[] | null;
  /** A home's growth was saved: the homes are read again. */
  onGrowthKept: () => void;
}) {
  const t = useT();
  const locale = useLocale();
  const colors = useThemeColors();
  const [open, setOpen] = useState(false);
  const history = useMemo(
    () =>
      new Map(
        envelopes.map((envelope) => [
          envelope.id,
          historyReturnFor(envelope, wallets),
        ]),
      ),
    [envelopes, wallets],
  );

  function change(envelope: Envelope, patch: EnvelopeEdit) {
    onEdits({
      ...edits,
      [envelope.id]: { ...edits[envelope.id], ...patch },
    });
  }

  return (
    <Card className="gap-4 px-5 py-1">
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        onPress={() => {
          void hapticSelection();
          setOpen((value) => !value);
        }}
        className="min-h-14 flex-row items-center justify-between gap-3"
      >
        <View className="flex-row items-center gap-2">
          <Ionicons
            name="options-outline"
            size={ICON.md}
            color={colors.mutedForeground}
          />
          <Text variant="muted" className="text-sm font-medium">
            {open
              ? t("trajectory.hypothesesHide")
              : t("trajectory.hypothesesTitle")}
          </Text>
        </View>
        <Ionicons
          name={open ? "chevron-up" : "chevron-down"}
          size={ICON.md}
          color={colors.mutedForeground}
        />
      </Pressable>

      {open ? (
        <View className="gap-4 pb-4">
          <Text variant="muted" className="text-sm">
            {t("trajectory.hypothesesLead")}
          </Text>
          {Object.keys(edits).length > 0 ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                void hapticSelection();
                onEdits({});
              }}
              className="min-h-11 justify-center self-start"
            >
              <Text className="text-sm font-medium text-primary">
                {t("futurePlan.accountsReset")}
              </Text>
            </Pressable>
          ) : null}

          {edited.map((envelope) => {
            const base = history.get(envelope.id) ?? null;
            const typed = edits[envelope.id]?.annualReturn;
            const isPel = envelope.id === "pel";
            const returnValue = typed ?? (isPel ? envelope.annualReturn : base);
            const name = t(ENVELOPE_SHORT_KEYS[envelope.id]);
            const spelled = t(ENVELOPE_NAME_KEYS[envelope.id]);
            const returnHint = isPel
              ? t("trajectory.returnContract")
              : base !== null
                ? t("trajectory.returnFromHistory", {
                    from: HISTORY_START.slice(0, 4),
                    to: HISTORY_END.slice(0, 4),
                    rate: formatPercentLabel(base * 100, locale),
                  })
                : null;
            const hasFees = !(
              envelope.id === "savings" || isSavingsKind(envelope.id)
            );
            return (
              <View
                key={envelope.id}
                className="gap-3 rounded-control border border-border p-3"
              >
                <View>
                  <Text className="text-sm font-medium">{name}</Text>
                  {spelled !== name ? (
                    <Text variant="muted" className="text-xs">
                      {spelled}
                    </Text>
                  ) : null}
                </View>
                <View className="flex-row gap-3">
                  <NumberField
                    label={t("futurePlan.fieldInitial")}
                    value={envelope.initial}
                    kind="money"
                    onChange={(initial) => change(envelope, { initial })}
                  />
                  <NumberField
                    label={t("futurePlan.fieldMonthly")}
                    value={envelope.monthly}
                    kind="money"
                    onChange={(monthly) => change(envelope, { monthly })}
                  />
                </View>
                <View className="gap-1">
                  {returnValue === null ? (
                    <View className="gap-1">
                      <Text variant="muted" className="text-xs">
                        {t("futurePlan.fieldReturn")}
                      </Text>
                      <Text variant="muted" className="text-xs">
                        {t("trajectory.returnNone")}
                      </Text>
                    </View>
                  ) : (
                    <View className="flex-row">
                      <NumberField
                        label={t("futurePlan.fieldReturn")}
                        value={returnValue}
                        kind="percent"
                        decimals={2}
                        min={-0.2}
                        max={0.3}
                        onChange={(annualReturn) =>
                          change(envelope, { annualReturn })
                        }
                      />
                    </View>
                  )}
                  {returnValue !== null && returnHint ? (
                    <Text variant="muted" className="text-xs">
                      {returnHint}
                    </Text>
                  ) : null}
                </View>
                <View className="flex-row gap-3">
                  {hasFees ? (
                    <NumberField
                      label={t("futurePlan.fieldFees")}
                      value={envelope.fees ?? 0}
                      kind="percent"
                      decimals={2}
                      max={0.05}
                      onChange={(fees) => change(envelope, { fees })}
                    />
                  ) : null}
                  <NumberField
                    label={t("futurePlan.fieldTax")}
                    value={envelope.taxOnGains}
                    kind="percent"
                    max={1}
                    onChange={(taxOnGains) => change(envelope, { taxOnGains })}
                  />
                </View>
                <Text variant="muted" className="text-xs">
                  {t(ENVELOPE_TAX_KEYS[envelope.id])}
                </Text>
              </View>
            );
          })}

          {properties && properties.length > 0 ? (
            <HomesGrowth properties={properties} onKept={onGrowthKept} />
          ) : null}

          <View className="gap-1">
            <Text variant="muted" className="text-xs">
              {t("trajectory.realTermsNote")}
            </Text>
            <Text variant="muted" className="text-xs">
              {t("trajectory.reconstructedNote")}
            </Text>
            <Text variant="muted" className="text-xs">
              {t("trajectory.pastNotPromise")}
            </Text>
          </View>

          <View className="gap-2">
            <Text className="text-sm font-medium">
              {t("trajectory.sourcesTitle")}
            </Text>
            {HISTORY_SOURCES.map((source) => (
              <Pressable
                key={source.title}
                accessibilityRole="link"
                onPress={() => void Linking.openURL(source.url)}
                className="min-h-11 justify-center"
              >
                <Text variant="muted" className="text-xs">
                  <Text className="text-xs font-medium text-foreground underline">
                    {source.publisher}
                  </Text>
                  {` — ${source.title} · ${source.terms}`}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}
    </Card>
  );
}

/**
 * Each home's yearly growth, the one figure in « Hypothèses » kept for the
 * account: held here while it is typed, saved when the field is left.
 */
function HomesGrowth({
  properties,
  onKept,
}: {
  properties: readonly PropertyRead[];
  onKept: () => void;
}) {
  const t = useT();
  const { toast } = useToast();
  const saved = (read: PropertyRead) =>
    read.property.yearly_growth === null
      ? DEFAULT_PROPERTY_GROWTH
      : Number(read.property.yearly_growth);
  const [growth, setGrowthFor] = useState<Record<string, number>>(() =>
    Object.fromEntries(properties.map((read) => [read.property.id, saved(read)])),
  );
  const [kept, setKept] = useState(growth);

  function keep(propertyId: string) {
    const rate = growth[propertyId];
    if (rate === undefined || rate === kept[propertyId]) {
      return;
    }
    setKept((current) => ({ ...current, [propertyId]: rate }));
    void setGrowth(propertyId, rate).then((result) => {
      if (result.success) {
        onKept();
      } else {
        toast(resolveMessage(t, result.error), "error");
      }
    });
  }

  return (
    <View className="gap-3">
      {properties.map((read) => (
        <View
          key={read.property.id}
          className="gap-3 rounded-control border border-border p-3"
        >
          <Text className="text-sm font-medium">{read.property.name}</Text>
          <View className="flex-row">
            <NumberField
              label={t("property.longViewGrowth")}
              value={growth[read.property.id] ?? saved(read)}
              kind="percent"
              min={-0.2}
              max={0.2}
              onChange={(next) =>
                setGrowthFor((current) => ({
                  ...current,
                  [read.property.id]: next,
                }))
              }
              onDone={() => keep(read.property.id)}
            />
          </View>
        </View>
      ))}
    </View>
  );
}

import { useMemo, useState, type ReactNode } from "react";
import { Linking, Pressable, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { formatPercentLabel } from "@finance/core/constants";
import {
  ENVELOPE_SHORT_KEYS,
  ENVELOPE_TAX_KEYS,
  type Envelope,
} from "@finance/core/future-plan";
import type { WalletMix } from "@finance/core/history/mix";
import { historyReturnFor } from "@finance/core/history/plan-accounts";
import {
  homesLine,
  mixKeys,
  trajectoryAccountKey,
} from "@finance/core/history/plan-figures";
import type {
  EnvelopeEdit,
  PlanEdits,
} from "@finance/core/history/plan-settings";
import type {
  LossOdds,
  MixKey,
  ReplayAccount,
} from "@finance/core/history/replay";
import { HISTORY_END, HISTORY_START } from "@finance/core/history/series";
import { HISTORY_SOURCES } from "@finance/core/history/sources";
import type { Locale } from "@finance/core/i18n/locale";
import { resolveMessage, type Key, type Translate } from "@finance/core/i18n/t";
import type { InvestmentWalletId } from "@finance/core/investments";
import { DEFAULT_PROPERTY_GROWTH } from "@finance/core/property-future";
import { isSavingsKind } from "@finance/core/savings-accounts";
import type { PropertyRead } from "@finance/data/properties";

import { Text } from "@/components/ui/Text";
import { hapticSelection } from "@/lib/haptics";
import { setGrowth } from "@/lib/properties";
import { useLocale, useT } from "@/providers/LocaleProvider";
import { useToast } from "@/providers/ToastProvider";
import { ICON } from "@/theme/tokens";
import { useThemeColors } from "@/theme/useThemeColors";

import { NumberField } from "./Fields";
import { usePlanMoney } from "./format";
import type { PlanReplay } from "./use-plan-replay";

/**
 * « Vos comptes », under the chart and in the same card, as on the web:
 * each account with what it holds today, what goes in each month, the
 * yearly return its history gave, its fees and the tax on its gains — every
 * one of them the reader's to change, and the chart follows. The current
 * account and what is set aside with no account sit in it too, read-only,
 * because the line starts from them as well; the total says where it
 * starts.
 *
 * A changed return shifts the account's whole history, its falls kept. The
 * milestones never read these edits: they are about money that exists. A
 * home's yearly growth is the one figure kept for the account, as its own
 * screen keeps it. Was « Hypothèses », folded under the screen, until the
 * owner asked for the figures to sit where the chart is (October 2026).
 */
export function PlanAccounts({
  replay,
  edits,
  onEdits,
  properties,
  today,
  years,
  onGrowthKept,
}: {
  replay: PlanReplay;
  edits: PlanEdits;
  onEdits: (edits: PlanEdits) => void;
  /** The homes, when they join the chart. */
  properties: readonly PropertyRead[] | null;
  /** The ISO day, for the homes' values. */
  today: string;
  years: number;
  /** A home's growth was saved: the homes are read again. */
  onGrowthKept: () => void;
}) {
  const t = useT();
  const locale = useLocale();
  const { shown } = usePlanMoney();
  const signed = (value: number) =>
    `${value >= 0 ? "+" : "−"}${shown(Math.abs(value))}`;
  const history = useMemo(
    () =>
      new Map(
        replay.dataEnvelopes.map((envelope) => [
          envelope.id,
          historyReturnFor(envelope, replay.wallets),
        ]),
      ),
    [replay.dataEnvelopes, replay.wallets],
  );
  const byId = new Map(replay.accounts.map((account) => [account.id, account]));
  const cash = replay.accounts.filter(
    (account) => account.id === "current" || account.id === "elsewhere",
  );
  const monthly = replay.accounts.reduce(
    (sum, account) => sum + account.monthly,
    0,
  );
  // The withdrawal's rate, applied to where the invested accounts end.
  const investedEnd = replay.result.accounts
    .filter((account) => replay.investedIds.has(account.id))
    .reduce((sum, account) => sum + account.median, 0);

  function change(envelope: Envelope, patch: EnvelopeEdit) {
    onEdits({
      ...edits,
      [envelope.id]: { ...edits[envelope.id], ...patch },
    });
  }

  return (
    <View className="gap-3 border-t border-border pt-4">
      <View className="gap-1">
        <Text accessibilityRole="header" className="text-base font-semibold">
          {t("trajectory.accountsTitle")}
        </Text>
        <Text variant="muted" className="text-sm">
          {t("trajectory.accountsLead")}
        </Text>
      </View>
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

      {cash.map((account) => (
        <Row
          key={account.id}
          name={t(trajectoryAccountKey(account.id))}
          notes={[
            account.id === "current"
              ? t("trajectory.currentLine")
              : t("trajectory.elsewhereLine"),
          ]}
        >
          <View className="flex-row gap-3">
            <Fixed label={t("futurePlan.fieldInitial")}>
              {shown(account.value)}
            </Fixed>
            <Fixed
              label={t("futurePlan.fieldMonthly")}
              hint={t("trajectory.monthlyFromLedger")}
            >
              {`≈ ${signed(account.monthly)}`}
            </Fixed>
          </View>
        </Row>
      ))}

      {replay.envelopes.map((envelope) => {
        const account = byId.get(envelope.id);
        const base = history.get(envelope.id) ?? null;
        const typed = edits[envelope.id]?.annualReturn;
        const isPel = envelope.id === "pel";
        // History's own return to a tenth, as the line under it says it; a
        // typed one as it was typed.
        const returnValue =
          typed ??
          (isPel
            ? envelope.annualReturn
            : base === null
              ? null
              : Math.round(base * 1000) / 1000);
        const returnHint = isPel
          ? t("trajectory.returnContract")
          : base !== null
            ? t("trajectory.returnFromHistory", {
                from: HISTORY_START.slice(0, 4),
                to: HISTORY_END.slice(0, 4),
                rate: formatPercentLabel(Math.round(base * 1000) / 10, locale),
              })
            : null;
        const hasFees = !(
          envelope.id === "savings" || isSavingsKind(envelope.id)
        );
        return (
          <Row
            key={envelope.id}
            name={t(ENVELOPE_SHORT_KEYS[envelope.id])}
            notes={
              account
                ? accountNotes({
                    account,
                    wallet: replay.wallets[envelope.id as InvestmentWalletId],
                    odds: replay.odds.get(envelope.id) ?? null,
                    years,
                    t,
                    locale,
                  })
                : []
            }
          >
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
                onChange={(value) => change(envelope, { monthly: value })}
              />
            </View>
            <View className="flex-row gap-3">
              {returnValue === null ? (
                <Fixed
                  label={t("futurePlan.fieldReturn")}
                  hint={t("trajectory.returnNone")}
                >
                  —
                </Fixed>
              ) : (
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
              )}
              {hasFees ? (
                <NumberField
                  label={t("futurePlan.fieldFees")}
                  value={envelope.fees ?? 0}
                  kind="percent"
                  decimals={2}
                  max={0.05}
                  onChange={(fees) => change(envelope, { fees })}
                />
              ) : (
                <NumberField
                  label={t("futurePlan.fieldTax")}
                  value={envelope.taxOnGains}
                  kind="percent"
                  max={1}
                  onChange={(taxOnGains) => change(envelope, { taxOnGains })}
                />
              )}
            </View>
            {returnValue !== null && returnHint ? (
              <Text variant="muted" className="text-xs">
                {returnHint}
              </Text>
            ) : null}
            {hasFees ? (
              <View className="flex-row">
                <NumberField
                  label={t("futurePlan.fieldTax")}
                  value={envelope.taxOnGains}
                  kind="percent"
                  max={1}
                  onChange={(taxOnGains) => change(envelope, { taxOnGains })}
                />
              </View>
            ) : null}
            <Text variant="muted" className="text-xs">
              {t(ENVELOPE_TAX_KEYS[envelope.id])}
            </Text>
          </Row>
        );
      })}

      {replay.property && properties
        ? properties.map((read) => (
            <HomeRow
              key={read.property.id}
              read={read}
              today={today}
              onKept={onGrowthKept}
            />
          ))
        : null}

      <View className="flex-row flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-t border-border pt-3">
        <Text className="text-sm font-semibold">
          {t("trajectory.totalLine")}
        </Text>
        <Text className="text-sm font-semibold tabular-nums">
          {`${shown(replay.today)} · ${t("futurePlan.whatIfPerMonth", {
            amount: shown(monthly),
          })}`}
        </Text>
      </View>

      {replay.withdrawal && investedEnd > 0 ? (
        <Text variant="muted" className="text-sm">
          {t("trajectory.incomeLine", {
            amount: shown((investedEnd * replay.withdrawal.always) / 12),
            rate: formatPercentLabel(replay.withdrawal.always * 100, locale),
            years: String(replay.withdrawal.years),
          })}
        </Text>
      ) : null}

      <SourcesFold />
    </View>
  );
}

/** One account: its name and what to know about it, then its figures. */
function Row({
  name,
  notes,
  children,
}: {
  name: string;
  notes: readonly string[];
  children: ReactNode;
}) {
  return (
    <View className="gap-3 rounded-control border border-border p-3">
      <View className="gap-0.5">
        <Text className="text-sm font-medium">{name}</Text>
        {notes.map((note) => (
          <Text key={note} variant="muted" className="text-xs">
            {note}
          </Text>
        ))}
      </View>
      {children}
    </View>
  );
}

/** A figure the reader cannot change here, in a field's place. */
function Fixed({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <View className="min-w-0 flex-1 gap-1">
      <Text variant="muted" numberOfLines={1} className="text-xs">
        {label}
      </Text>
      <View className="min-h-12 justify-center">
        <Text className="text-base tabular-nums">{children}</Text>
      </View>
      {hint ? (
        <Text variant="muted" className="text-xs">
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

/**
 * What follows an account's name: the history it follows, how often that
 * ended below prices over the horizon, and what stands in or holds still.
 */
function accountNotes({
  account,
  wallet,
  odds,
  years,
  t,
  locale,
}: {
  account: ReplayAccount;
  wallet: WalletMix | undefined;
  odds: LossOdds | null;
  years: number;
  t: Translate;
  locale: Locale;
}): string[] {
  const keys = mixKeys(account.mix);
  const seriesName = (key: MixKey) => t(`trajectory.series.${key}` as Key);
  const percent = (share: number) =>
    formatPercentLabel(Math.round(share * 100), locale);
  const notes: string[] = [];
  if (account.fixedRate !== undefined) {
    notes.push(t("trajectory.returnContract"));
  } else if (keys.length === 1) {
    notes.push(t("trajectory.follows", { series: seriesName(keys[0]!) }));
  } else if (keys.length > 1) {
    notes.push(
      t("trajectory.followsMix", {
        first: seriesName(keys[0]!),
        rest: keys.slice(1).map(seriesName).join(", "),
      }),
    );
  }
  // Bitcoin's history is too short to say how often it lost over years.
  if (odds && odds.windows >= 120 && (account.mix.bitcoin ?? 0) === 0) {
    notes.push(
      odds.losses === 0
        ? t("trajectory.lossNever", { years: String(years), since: "1970" })
        : t("trajectory.lossLine", {
            years: String(years),
            count: String(
              Math.max(1, Math.round((odds.losses / odds.windows) * 100)),
            ),
            since: "1970",
          }),
    );
  }
  if ((account.mix.bitcoin ?? 0) > 0) {
    notes.push(t("trajectory.cryptoFlat"));
  }
  if (wallet && wallet.standInShare > 0.005) {
    notes.push(t("trajectory.standIn", { share: percent(wallet.standInShare) }));
  }
  if (wallet && wallet.unknownShare > 0.005 && keys[0]) {
    notes.push(
      t("trajectory.unknown", {
        share: percent(wallet.unknownShare),
        series: seriesName(keys[0]),
      }),
    );
  }
  return notes;
}

/**
 * A home in the chart: its net value today, and its yearly growth — the one
 * figure here kept for the account, saved when the field is left.
 */
function HomeRow({
  read,
  today,
  onKept,
}: {
  read: PropertyRead;
  today: string;
  onKept: () => void;
}) {
  const t = useT();
  const { toast } = useToast();
  const { shown } = usePlanMoney();
  const saved =
    read.property.yearly_growth === null
      ? DEFAULT_PROPERTY_GROWTH
      : Number(read.property.yearly_growth);
  const [growth, setGrowthTo] = useState(saved);
  const [kept, setKept] = useState(saved);
  const net = useMemo(() => homesLine([read], today, 0)[0] ?? 0, [read, today]);

  function keep() {
    if (growth === kept) {
      return;
    }
    setKept(growth);
    void setGrowth(read.property.id, growth).then((result) => {
      if (result.success) {
        onKept();
      } else {
        toast(resolveMessage(t, result.error), "error");
      }
    });
  }

  return (
    <Row name={read.property.name} notes={[t("trajectory.withPropertyHint")]}>
      <View className="flex-row gap-3">
        <Fixed label={t("futurePlan.fieldInitial")}>{shown(net)}</Fixed>
        <NumberField
          label={t("property.longViewGrowth")}
          value={growth}
          kind="percent"
          min={-0.2}
          max={0.2}
          onChange={setGrowthTo}
          onDone={keep}
        />
      </View>
    </Row>
  );
}

/** Where the history comes from and on what terms, folded. */
function SourcesFold() {
  const t = useT();
  const locale = useLocale();
  const colors = useThemeColors();
  const [open, setOpen] = useState(false);
  return (
    <View className="border-t border-border">
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        onPress={() => {
          void hapticSelection();
          setOpen((value) => !value);
        }}
        className="min-h-12 flex-row items-center justify-between gap-3"
      >
        <Text variant="muted" className="text-sm font-medium">
          {t("trajectory.sourcesFold")}
        </Text>
        <Ionicons
          name={open ? "chevron-up" : "chevron-down"}
          size={ICON.md}
          color={colors.mutedForeground}
        />
      </Pressable>
      {open ? (
        <View className="gap-2 pb-1">
          <Text variant="muted" className="text-xs">
            {t("trajectory.realTermsNote")}
          </Text>
          <Text variant="muted" className="text-xs">
            {t("trajectory.reconstructedNote")}
          </Text>
          <Text variant="muted" className="text-xs">
            {t("trajectory.pastNotPromise")}
          </Text>
          {HISTORY_SOURCES.map((source) => (
            <Pressable
              key={source.url}
              accessibilityRole="link"
              onPress={() => void Linking.openURL(source.url)}
              className="min-h-11 justify-center"
            >
              <Text variant="muted" className="text-xs">
                <Text className="text-xs font-medium text-foreground underline">
                  {source.publisher[locale]}
                </Text>
                {` — ${source.title[locale]} · ${source.terms[locale]}`}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

"use client";

import { useMemo, useState, type ReactNode } from "react";
import { CaretDown } from "@phosphor-icons/react";
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
import type { Key } from "@finance/core/i18n/t";
import type { InvestmentWalletId } from "@finance/core/investments";
import { DEFAULT_PROPERTY_GROWTH } from "@finance/core/property-future";
import { isSavingsKind } from "@finance/core/savings-accounts";
import type { PropertyRead } from "@finance/data/properties";
import { useToast } from "@/components/layout/ToastProvider";
import { setGrowth } from "@/lib/actions/property";
import { ICON } from "@/lib/icon-scale";
import { useLocale, useT } from "@/lib/locale-context";
import { useFormatCurrency } from "@/lib/use-currency";
import { cn } from "@/lib/utils";
import { NumberField } from "./plan-controls";
import type { PlanReplay } from "./use-plan-replay";

/** The account's name, then today, each month, return, fees, tax. */
const COLUMNS =
  "md:grid md:grid-cols-[minmax(0,1.7fr)_repeat(5,minmax(0,1fr))] md:items-start md:gap-x-3";

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * « Vos comptes », under the chart and in the same card, because the chart
 * is made of them: each account with what it holds today, what goes in each
 * month, the yearly return its history gave, its fees and the tax on its
 * gains — every one of them the reader's to change, and the chart follows.
 * The current account and what is set aside with no account sit in it too,
 * read-only, because the line starts from them as well; the total says
 * where it starts.
 *
 * A changed return shifts the account's whole history, its falls kept. The
 * milestones never read these edits: they are about money that exists. A
 * home's yearly growth is the one figure kept for the account, as its own
 * page keeps it. Was « Hypothèses », folded under the page, until the owner
 * asked for the figures to sit where the chart is (October 2026).
 */
export function PlanAccounts({
  replay,
  edits,
  onEdits,
  properties,
  today,
  years,
}: {
  replay: PlanReplay;
  edits: PlanEdits;
  onEdits: (edits: PlanEdits) => void;
  /** The homes, when they join the chart. */
  properties: readonly PropertyRead[] | null;
  /** The ISO day, for the homes' values. */
  today: string;
  years: number;
}) {
  const t = useT();
  const locale = useLocale();
  const format = useFormatCurrency();
  const money = (value: number) => format(Math.round(value));
  const signed = (value: number) =>
    `${value >= 0 ? "+" : "−"}${money(Math.abs(value))}`;
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
    <section
      aria-labelledby="plan-accounts-title"
      className="flex flex-col gap-4 border-t border-border pt-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex max-w-prose flex-col gap-1">
          <h3 id="plan-accounts-title" className="text-base font-medium">
            {t("trajectory.accountsTitle")}
          </h3>
          <p className="text-sm text-muted-foreground">
            {t("trajectory.accountsLead")}
          </p>
        </div>
        {Object.keys(edits).length > 0 ? (
          <button
            type="button"
            onClick={() => onEdits({})}
            className="min-h-11 text-sm font-medium text-primary-ink underline-offset-4 hover:underline"
          >
            {t("futurePlan.accountsReset")}
          </button>
        ) : null}
      </div>

      <div
        aria-hidden
        className={cn(COLUMNS, "hidden text-xs text-muted-foreground")}
      >
        <span>{t("trajectory.accountColumn")}</span>
        <span>{t("futurePlan.fieldInitial")}</span>
        <span>{t("futurePlan.fieldMonthly")}</span>
        <span>{t("futurePlan.fieldReturn")}</span>
        <span>{t("futurePlan.fieldFees")}</span>
        <span>{t("futurePlan.fieldTax")}</span>
      </div>

      <ul className="flex flex-col gap-3 md:gap-0 md:divide-y md:divide-border">
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
            <Fixed label={t("futurePlan.fieldInitial")} sensitive>
              {money(account.value)}
            </Fixed>
            <Fixed
              label={t("futurePlan.fieldMonthly")}
              hint={t("trajectory.monthlyFromLedger")}
              sensitive
            >
              {`≈ ${signed(account.monthly)}`}
            </Fixed>
            <Fixed label={t("futurePlan.fieldReturn")} wideOnly>
              {formatPercentLabel(0, locale)}
            </Fixed>
            <Fixed label={t("futurePlan.fieldFees")} wideOnly>
              —
            </Fixed>
            <Fixed label={t("futurePlan.fieldTax")} wideOnly>
              —
            </Fixed>
          </Row>
        ))}

        {replay.envelopes.map((envelope) => {
          const account = byId.get(envelope.id);
          const base = history.get(envelope.id) ?? null;
          const typed = edits[envelope.id]?.annualReturn;
          const isPel = envelope.id === "pel";
          // History's own return to a tenth, as the line under it says it;
          // a typed one as it was typed.
          const returnValue =
            typed ??
            (isPel
              ? envelope.annualReturn
              : base === null
                ? null
                : Math.round(base * 1000) / 1000);
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
              taxNote={t(ENVELOPE_TAX_KEYS[envelope.id])}
            >
              <NumberField
                label={t("futurePlan.fieldInitial")}
                labelHidden="md"
                value={envelope.initial}
                onChange={(initial) => change(envelope, { initial })}
                min={0}
                sensitive
              />
              <NumberField
                label={t("futurePlan.fieldMonthly")}
                labelHidden="md"
                value={envelope.monthly}
                onChange={(value) => change(envelope, { monthly: value })}
                min={0}
                sensitive
              />
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
                  labelHidden="md"
                  value={round2(returnValue * 100)}
                  onChange={(value) =>
                    change(envelope, { annualReturn: value / 100 })
                  }
                  min={-20}
                  max={30}
                  suffix="%"
                  hint={
                    isPel
                      ? t("trajectory.returnContract")
                      : base !== null
                        ? t("trajectory.returnFromHistory", {
                            from: HISTORY_START.slice(0, 4),
                            to: HISTORY_END.slice(0, 4),
                            rate: formatPercentLabel(
                              Math.round(base * 1000) / 10,
                              locale,
                            ),
                          })
                        : undefined
                  }
                />
              )}
              {hasFees ? (
                <NumberField
                  label={t("futurePlan.fieldFees")}
                  labelHidden="md"
                  value={round2((envelope.fees ?? 0) * 100)}
                  onChange={(value) => change(envelope, { fees: value / 100 })}
                  min={0}
                  max={5}
                  suffix="%"
                />
              ) : (
                <Fixed label={t("futurePlan.fieldFees")} wideOnly>
                  —
                </Fixed>
              )}
              <NumberField
                label={t("futurePlan.fieldTax")}
                labelHidden="md"
                value={round2(envelope.taxOnGains * 100)}
                onChange={(value) =>
                  change(envelope, { taxOnGains: value / 100 })
                }
                min={0}
                max={100}
                suffix="%"
              />
            </Row>
          );
        })}

        {replay.property && properties
          ? properties.map((read) => (
              <HomeRow key={read.property.id} read={read} today={today} />
            ))
          : null}
      </ul>

      <div
        className={cn(
          COLUMNS,
          "flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-t border-border pt-3 text-sm font-medium",
        )}
      >
        <span>{t("trajectory.totalLine")}</span>
        <span className="privacy-sensitive tabular-nums">
          {money(replay.today)}
        </span>
        <span className="privacy-sensitive tabular-nums">
          {t("futurePlan.whatIfPerMonth", { amount: money(monthly) })}
        </span>
      </div>

      {replay.withdrawal && investedEnd > 0 ? (
        <p className="privacy-sensitive text-sm text-muted-foreground">
          {t("trajectory.incomeLine", {
            amount: money((investedEnd * replay.withdrawal.always) / 12),
            rate: formatPercentLabel(replay.withdrawal.always * 100, locale),
            years: String(replay.withdrawal.years),
          })}
        </p>
      ) : null}

      <SourcesFold />
    </section>
  );
}

/** One account: its name and what to know about it, then its figures. */
function Row({
  name,
  notes,
  taxNote,
  children,
}: {
  name: string;
  notes: readonly string[];
  /** The tax the account pays, said under its figures. */
  taxNote?: string;
  children: ReactNode;
}) {
  return (
    <li
      className={cn(
        COLUMNS,
        "flex flex-col gap-3 rounded-control border border-border p-3 md:rounded-none md:border-0 md:px-0 md:py-3",
      )}
    >
      <div className="flex min-w-0 flex-col gap-0.5">
        <p className="text-sm font-medium">{name}</p>
        {notes.map((note) => (
          <p key={note} className="text-xs text-muted-foreground">
            {note}
          </p>
        ))}
        {taxNote ? (
          <p className="text-xs text-muted-foreground md:hidden">{taxNote}</p>
        ) : null}
      </div>
      {/* Two columns of fields on a phone; the table's own columns on a
          wider screen, where the labels are the header row's. */}
      <div className="grid grid-cols-2 gap-3 md:contents">{children}</div>
    </li>
  );
}

/**
 * A figure the reader cannot change here, in a field's place. `wideOnly`
 * for one that does not apply — a dash — which the table's column needs and
 * a phone-width card does not.
 */
function Fixed({
  label,
  hint,
  sensitive = false,
  wideOnly = false,
  children,
}: {
  label: string;
  hint?: string;
  sensitive?: boolean;
  wideOnly?: boolean;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "min-w-0 flex-col gap-1",
        wideOnly ? "hidden md:flex" : "flex",
      )}
    >
      <span className="text-xs text-muted-foreground md:sr-only">{label}</span>
      <span
        className={cn(
          "flex min-h-11 items-center text-sm tabular-nums",
          sensitive && "privacy-sensitive",
        )}
      >
        {children}
      </span>
      {hint ? (
        <span className="text-xs text-muted-foreground">{hint}</span>
      ) : null}
    </div>
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
  t: ReturnType<typeof useT>;
  locale: ReturnType<typeof useLocale>;
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
    notes.push(
      t("trajectory.standIn", { share: percent(wallet.standInShare) }),
    );
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
function HomeRow({ read, today }: { read: PropertyRead; today: string }) {
  const t = useT();
  const { toast } = useToast();
  const format = useFormatCurrency();
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
      if (!result.success) {
        toast(result.error, "error");
      }
    });
  }

  return (
    <Row name={read.property.name} notes={[t("trajectory.withPropertyHint")]}>
      <Fixed label={t("futurePlan.fieldInitial")} sensitive>
        {format(Math.round(net))}
      </Fixed>
      <Fixed label={t("futurePlan.fieldMonthly")} wideOnly>
        —
      </Fixed>
      <div onBlur={keep}>
        <NumberField
          label={t("property.longViewGrowth")}
          labelHidden="md"
          value={Math.round(growth * 1000) / 10}
          min={-20}
          max={20}
          suffix="%"
          onChange={(percent) => setGrowthTo(percent / 100)}
        />
      </div>
      <Fixed label={t("futurePlan.fieldFees")} wideOnly>
        —
      </Fixed>
      <Fixed label={t("futurePlan.fieldTax")} wideOnly>
        —
      </Fixed>
    </Row>
  );
}

/** Where the history comes from and on what terms, folded. */
function SourcesFold() {
  const t = useT();
  const [open, setOpen] = useState(false);
  return (
    <div className="border-t border-border pt-2">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="flex min-h-11 w-full items-center justify-between gap-3 text-left text-sm font-medium text-muted-foreground transition-colors duration-hover hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {t("trajectory.sourcesFold")}
        <CaretDown
          size={ICON.sm}
          aria-hidden
          className={cn(
            "transition-transform duration-hover",
            open && "rotate-180",
          )}
        />
      </button>
      {open ? (
        <div className="mt-2 flex flex-col gap-3 text-xs text-muted-foreground">
          <div className="flex flex-col gap-1">
            <p>{t("trajectory.realTermsNote")}</p>
            <p>{t("trajectory.reconstructedNote")}</p>
            <p>{t("trajectory.pastNotPromise")}</p>
          </div>
          <ul className="flex flex-col gap-1.5">
            {HISTORY_SOURCES.map((source) => (
              <li key={source.title}>
                <a
                  href={source.url}
                  target="_blank"
                  rel="noreferrer"
                  className="font-medium text-foreground underline-offset-4 hover:underline"
                >
                  {source.publisher}
                </a>
                {" — "}
                {source.title}
                {" · "}
                {source.terms}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

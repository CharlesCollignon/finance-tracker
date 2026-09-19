"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  ArrowsClockwise,
  Books,
  Coins,
  Eye,
  Globe,
  Target,
  Warning,
} from "@phosphor-icons/react";

import {
  SECTOR_LABELS,
  drainStep,
  type DrainHalt,
} from "@finance/core/instrument-reading";
import { INVESTMENT_WALLET_LABELS } from "@finance/core/investments";
import { formatCharge } from "@finance/core/fund-costs";
import { AXIS_COVERAGE_FLOOR } from "@finance/core/look-through";
import type { LookThrough } from "@finance/core/look-through";
import type {
  ArbitrageMove,
  TargetAllocation,
} from "@finance/core/look-through-target";
import type { RenderedWalletRead } from "@finance/core/wallet-read";
import type { ReadSegment } from "@finance/core/month-read";
import type { Key } from "@finance/core/i18n/t";

import { Badge } from "@/components/retroui/Badge";
import { Button, buttonVariants } from "@/components/retroui/Button";
import { Card } from "@/components/retroui/Card";
import { EmptyState } from "@/components/layout/EmptyState";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { SurfaceTabs, WALLET_TABS } from "@/components/layout/SurfaceTabs";
import { StatHero } from "@/components/finance/StatHero";
import { WeightBars } from "@/components/finance/WeightBars";
import { RefreshQuotesButton } from "@/components/finance/RefreshQuotesButton";
import { Stagger, StaggerItem } from "@/components/motion/Stagger";
import { readNextInstrument, reviewWallets } from "@/lib/actions/wallet-read";
import { useFormatCurrency } from "@/lib/use-currency";
import { useT } from "@/lib/locale-context";
import { useToast } from "@/components/layout/ToastProvider";
import { ICON } from "@/lib/icon-scale";
import { MICRO } from "@/lib/type-scale";
import { cn } from "@/lib/utils";

/**
 * What to say when a walk stops early.
 *
 * A total map rather than a switch, so adding a halt to `DrainHalt` without
 * giving it words is a type error rather than a silent blank toast. `done` is
 * absent on purpose: an emptied queue is the walk succeeding, and has nothing
 * to report.
 */
const HALT_MESSAGES: Record<Exclude<DrainHalt, "done">, Key> = {
  cooling: "lookThrough.halt.cooling",
  allowance: "lookThrough.halt.allowance",
  "not-yours": "lookThrough.halt.notYours",
  "no-reader": "lookThrough.halt.noReader",
  unavailable: "lookThrough.halt.unavailable",
  "signed-out": "lookThrough.halt.signedOut",
};

export interface LookThroughViewProps {
  lookThrough: LookThrough;
  target: TargetAllocation;
  read: RenderedWalletRead | null;
  footing: string[];
  /** Null when nothing has been read. */
  readAt: string | null;
  /** True when the figures have moved since the read was written. */
  stale: boolean;
  readsLeft: number;
  /** False when there is no key, or migration 033 has not run. */
  canReview: boolean;
  /** How many instruments are waiting to be read. */
  queueLength: number;
  /**
   * Holdings with no ISIN at all.
   *
   * The case that made this page a dead end: `queue` is built only from
   * positions that have an ISIN, so with none of them the read button never
   * rendered while every holding still showed as unread — a stated problem
   * with the explanation withheld.
   */
  unidentified: { positionId: string; name: string }[];
  /**
   * What would have to move to reach the target.
   *
   * Computed on the server, because it needs every position's market value —
   * which `LookThrough` deliberately does not carry, since its own figures
   * are shares of the classified part rather than per-position amounts.
   */
  arbitrage: ArbitrageMove[];
}

/**
 * What the wallets are made of.
 *
 * Ordered by what the arithmetic can say with most confidence, which is not
 * the order the question is usually asked in. What the app could *not* see
 * comes first when there is any of it — a reader who does not know that two
 * fifths of their money is unclassified will read every figure below as if it
 * described the whole portfolio.
 *
 * No ECharts here, deliberately. The one dense time series on this surface
 * earns a runtime; a ranked list of country weights and a handful of pairs do
 * not, and the four zero-runtime marks in `components/finance/charts` are the
 * house vocabulary for exactly this.
 */
export function LookThroughView({
  lookThrough,
  target,
  read,
  footing,
  readAt,
  stale,
  readsLeft,
  canReview,
  queueLength,
  unidentified,
  arbitrage,
}: LookThroughViewProps) {
  const t = useT();
  const formatEuro = useFormatCurrency();
  const { toast } = useToast();
  const [reviewing, startReview] = useTransition();
  const [reading, setReading] = useState(false);
  const [remaining, setRemaining] = useState(queueLength);

  const unclassified = lookThrough.caveats.find(
    (caveat) => caveat.kind === "unclassified",
  );

  /**
   * Whether a read could say anything at all.
   *
   * The same condition `lookThroughIsThin` applies server-side, checked here
   * so the button can refuse in advance instead of spending a press to
   * explain itself.
   */
  const canSayAnything =
    lookThrough.classifiedValue > 0 &&
    lookThrough.countries.length + lookThrough.sectors.length > 0;

  function onReview() {
    startReview(async () => {
      const outcome = await reviewWallets();
      if (outcome.message) {
        toast(outcome.message);
      }
    });
  }

  /**
   * Walk the queue one instrument at a time.
   *
   * Sequential rather than parallel, and one request each. A search-backed
   * read takes tens of seconds, so a portfolio's worth of them in one request
   * would be killed by the platform with the allowance already spent — and
   * one at a time is also what lets the count go down in front of the reader
   * instead of a spinner sitting there for two minutes.
   *
   * What to do with each answer is `drainStep`'s decision, not this
   * function's. The rule is subtle enough to have been got wrong here: only
   * an instrument that actually left the queue may be walked past, because
   * every other answer leaves it at the head of the queue and carrying on
   * would ask about it again. The walk used to stop after a single instrument
   * for a different reason entirely — a two-second cooldown keyed on the user
   * rather than the instrument, reported as a spent allowance — which is
   * fixed on the server side in `read.ts`.
   */
  async function onReadAll() {
    setReading(true);
    try {
      let left = remaining;
      while (left > 0) {
        const outcome = await readNextInstrument();
        const step = drainStep(outcome.status, outcome.remaining);

        // The server's count is the truthful one either way, including the
        // zero that says the queue is empty. Dropping it on a halt is what
        // used to leave this button sitting over nothing.
        setRemaining(outcome.remaining);

        if (!step.go) {
          if (step.halt !== "done") {
            toast(t(HALT_MESSAGES[step.halt]), "error");
          }
          return;
        }

        left = step.remaining;
      }
    } finally {
      setReading(false);
    }
  }

  if (lookThrough.totalValue <= 0) {
    return (
      <>
        <PageHeader titleKey="nav.walletsLookThrough" />
        <PageContainer>
          <SurfaceTabs tabs={WALLET_TABS} className="mb-4" />
          <EmptyState
            title={t("lookThrough.title")}
            description={t("lookThrough.caveats.noMarketValue")}
          />
        </PageContainer>
      </>
    );
  }

  return (
    <>
      <PageHeader titleKey="nav.walletsLookThrough" />
      <PageContainer>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <SurfaceTabs tabs={WALLET_TABS} />
          <RefreshQuotesButton />
        </div>

        <Stagger className="flex w-full min-w-0 flex-col items-center gap-5">
          <StaggerItem className="w-full min-w-0">
            <StatHero
              label={t("lookThrough.readCoverage", {
                share: `${Math.round(lookThrough.classifiedShare * 100)}%`,
              })}
              amount={formatEuro(lookThrough.totalValue)}
              subtitle={
                lookThrough.charges.weightedAllIn !== null
                  ? t("lookThrough.allIn") +
                    " · " +
                    formatCharge(lookThrough.charges.weightedAllIn)
                  : undefined
              }
            />
          </StaggerItem>

          {/* What the app cannot see, before anything it can — and split by
              what would actually fix it, because the three cases have three
              different answers and merging them left no action at all. */}
          {unclassified?.kind === "unclassified" ? (
            <StaggerItem className="w-full min-w-0">
              <Section
                icon={<Eye size={ICON.md} weight="light" />}
                title={
                  unidentified.length > 0
                    ? t("lookThrough.caveats.noIsin")
                    : t("lookThrough.caveats.neverRead")
                }
                tone="warning"
              >
                <p className="text-sm text-muted-foreground">
                  {t("lookThrough.caveats.unclassified", {
                    share: `${Math.round(unclassified.share * 100)}%`,
                  })}
                </p>

                {/* No ISIN: nothing can be read until one is recorded, and the
                    instrument search is the only thing that records it. */}
                {unidentified.length > 0 ? (
                  <div className="mt-4 flex flex-col gap-2 border-t border-border pt-3">
                    <p className="text-sm">
                      {t("lookThrough.caveats.noIsinBody", {
                        count: unidentified.length,
                      })}
                    </p>
                    <ul className="flex flex-col gap-1">
                      {unidentified.map((row) => (
                        <li
                          key={row.positionId}
                          className="min-w-0 truncate text-sm text-muted-foreground"
                        >
                          {row.name}
                        </li>
                      ))}
                    </ul>
                    {/* A link, not a button with an onClick: this navigates,
                        and `buttonVariants` is how the app dresses a link as
                        a control without cloning children. */}
                    <Link
                      href="/investments"
                      className={cn(
                        buttonVariants({ variant: "outline", size: "sm" }),
                        "mt-1 self-start",
                      )}
                    >
                      {t("lookThrough.caveats.goToPositions")}
                    </Link>
                  </div>
                ) : null}

                {/* Has an ISIN, never read: this is the only case where
                    reading is the action, so it is the only case with the
                    button. */}
                {remaining > 0 ? (
                  <div className="mt-4 flex flex-col gap-2 border-t border-border pt-3">
                    <p className="text-sm">
                      {t("lookThrough.caveats.neverReadBody", {
                        count: remaining,
                      })}
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="self-start"
                      onClick={onReadAll}
                      disabled={reading}
                    >
                      <ArrowsClockwise
                        size={ICON.sm}
                        weight="light"
                        className={cn("mr-2", reading && "animate-spin")}
                      />
                      {reading
                        ? t("lookThrough.readingOne")
                        : t("lookThrough.readAll")}
                    </Button>
                  </div>
                ) : null}

                <ul className="mt-4 flex flex-col gap-1 border-t border-border pt-3">
                  {lookThrough.unclassifiedPositions.map((row) => (
                    <li
                      key={row.positionId}
                      className="flex items-baseline justify-between gap-3 text-sm"
                    >
                      <span className="min-w-0 truncate">{row.name}</span>
                      <span className="shrink-0 tabular-nums text-muted-foreground">
                        {formatEuro(row.value)}
                      </span>
                    </li>
                  ))}
                </ul>
              </Section>
            </StaggerItem>
          ) : null}

          {/* The read, when there is one. */}
          <StaggerItem className="w-full min-w-0">
            <Section
              icon={<Books size={ICON.md} weight="light" />}
              title={t("lookThrough.title")}
              action={
                canReview ? (
                  <Button
                    size="sm"
                    onClick={onReview}
                    // Nothing classified means the read would be refused.
                    // Disabling with the reason stated below beats a press
                    // that comes back as a toast explaining what it needed.
                    disabled={reviewing || !canSayAnything}
                  >
                    {reviewing
                      ? t("walletRead.reviewing")
                      : t("walletRead.review")}
                  </Button>
                ) : null
              }
            >
              {read === null ? (
                <div className="flex flex-col gap-2">
                  <p className="text-sm font-medium">{t("walletRead.empty")}</p>
                  <p className="text-sm text-muted-foreground">
                    {canSayAnything
                      ? t("walletRead.emptyBody")
                      : t("lookThrough.caveats.needsAReading")}
                  </p>
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  <div className="flex flex-wrap items-center gap-2">
                    {readAt ? (
                      <span className={cn(MICRO, "text-muted-foreground")}>
                        {t("walletRead.readAt", { when: readAt })}
                      </span>
                    ) : null}
                    {stale ? (
                      <Badge variant="outline" size="sm">
                        {t("walletRead.stale")}
                      </Badge>
                    ) : null}
                    {canReview ? (
                      <span className={cn(MICRO, "text-muted-foreground")}>
                        {t("walletRead.reviewHint", { remaining: readsLeft })}
                      </span>
                    ) : null}
                  </div>

                  <p className="text-base font-semibold">
                    <Segments segments={read.headline} />
                  </p>

                  <ul className="flex flex-col gap-3">
                    {read.observations.map((row, index) => (
                      <li key={index} className="flex gap-2 text-sm">
                        <span
                          aria-hidden="true"
                          className={cn(
                            "mt-1.5 size-1.5 shrink-0 rounded-full",
                            row.tone === "good" && "bg-[var(--success)]",
                            row.tone === "watch" && "bg-[var(--warning)]",
                            row.tone === "neutral" && "bg-muted-foreground",
                          )}
                        />
                        <span className="min-w-0">
                          <Segments segments={row.segments} />
                        </span>
                      </li>
                    ))}
                  </ul>

                  {read.suggestions.length > 0 ? (
                    <ul className="flex flex-col gap-3 border-t border-border pt-4">
                      {read.suggestions.map((row) => (
                        <li key={row.isin} className="flex flex-col gap-1">
                          <div className="flex flex-wrap items-baseline gap-2">
                            <span className="text-sm font-semibold">
                              {row.name}
                            </span>
                            <Badge variant="outline" size="sm">
                              {row.symbol}
                            </Badge>
                            <Badge variant="default" size="sm">
                              {INVESTMENT_WALLET_LABELS[row.wallet]}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            <Segments segments={row.segments} />
                          </p>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              )}

              <div className="mt-4 flex flex-col gap-1 border-t border-border pt-3">
                {footing.map((line) => (
                  <p key={line} className={cn(MICRO, "text-muted-foreground")}>
                    {line}
                  </p>
                ))}
              </div>
            </Section>
          </StaggerItem>

          {/* Geography. */}
          {lookThrough.countries.length > 0 ? (
            <StaggerItem className="w-full min-w-0">
              <Section
                icon={<Globe size={ICON.md} weight="light" />}
                title={t("lookThrough.geography")}
              >
                <WeightBars
                  rows={lookThrough.countries.map((row) => ({
                    id: row.id,
                    label: row.label,
                    weight: row.weight,
                  }))}
                  restLabel={(count) => `${count} more`}
                />
                <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 border-t border-border pt-3">
                  <Bias
                    label={t("lookThrough.franceShare")}
                    share={lookThrough.regions.france}
                    factor={lookThrough.regionBias.france}
                  />
                  <Bias
                    label={t("lookThrough.usShare")}
                    share={lookThrough.regions.unitedStates}
                    factor={lookThrough.regionBias.unitedStates}
                  />
                  <Bias
                    label={t("lookThrough.europeShare")}
                    share={lookThrough.regions.europe}
                    factor={lookThrough.regionBias.europe}
                  />
                </div>
                <p className={cn(MICRO, "mt-3 text-muted-foreground")}>
                  {t("lookThrough.caveats.geographyIsNotCurrency")}
                </p>
                <PartialAxis
                  coverage={lookThrough.countryCoverage}
                  rows={lookThrough.countries.length}
                />
              </Section>
            </StaggerItem>
          ) : null}

          {/* Sectors. */}
          {lookThrough.sectors.length > 0 ? (
            <StaggerItem className="w-full min-w-0">
              <Section
                icon={<Target size={ICON.md} weight="light" />}
                title={t("lookThrough.sectors")}
              >
                <WeightBars
                  rows={lookThrough.sectors.map((row) => ({
                    id: row.id,
                    label:
                      SECTOR_LABELS[row.id as keyof typeof SECTOR_LABELS] ??
                      row.label,
                    weight: row.weight,
                  }))}
                  restLabel={(count) => `${count} more`}
                />
                <PartialAxis
                  coverage={lookThrough.sectorCoverage}
                  rows={lookThrough.sectors.length}
                />
              </Section>
            </StaggerItem>
          ) : null}

          {/* Doubling up. */}
          {lookThrough.indexCollisions.length > 0 ? (
            <StaggerItem className="w-full min-w-0">
              <Section
                icon={<Warning size={ICON.md} weight="light" />}
                title={t("lookThrough.doublingUp")}
                tone="warning"
              >
                <ul className="flex flex-col gap-3">
                  {lookThrough.indexCollisions.map((collision) => (
                    <li
                      key={collision.positionIds.join("-")}
                      className="flex flex-col gap-0.5"
                    >
                      <span className="text-sm font-medium">
                        {collision.names[0]} · {collision.names[1]}
                      </span>
                      <span className={cn(MICRO, "text-muted-foreground")}>
                        {collision.identical
                          ? t("lookThrough.sameIndex", {
                              index: collision.indexes[0],
                            })
                          : t("lookThrough.nestedIndex", {
                              outer: collision.indexes[0],
                              inner: collision.indexes[1],
                            })}
                      </span>
                    </li>
                  ))}
                </ul>

                {lookThrough.constituentOverlaps.length > 0 ? (
                  <>
                    <ul className="mt-4 flex flex-col gap-2 border-t border-border pt-3">
                      {lookThrough.constituentOverlaps.map((overlap) => (
                        <li
                          key={overlap.positionIds.join("-")}
                          className="text-sm"
                        >
                          {t("lookThrough.sharedCompanies", {
                            count: overlap.sharedNames.length,
                            other: overlap.names[1],
                          })}
                          <span className="text-muted-foreground">
                            {" — "}
                            {overlap.sharedNames.slice(0, 5).join(", ")}
                          </span>
                        </li>
                      ))}
                    </ul>
                    {/* The limit travels with the figure, always. */}
                    <p className={cn(MICRO, "mt-3 text-muted-foreground")}>
                      {t("lookThrough.caveats.overlapIsAFloor")}
                    </p>
                  </>
                ) : null}
              </Section>
            </StaggerItem>
          ) : null}

          {/* Charges. */}
          <StaggerItem className="w-full min-w-0">
            <Section
              icon={<Coins size={ICON.md} weight="light" />}
              title={t("lookThrough.charges")}
            >
              <dl className="flex flex-col gap-2">
                <Line
                  label={t("lookThrough.fundCharges")}
                  value={formatCharge(lookThrough.charges.weightedAverage)}
                />
                {lookThrough.charges.weightedEnvelopeFee !== null ? (
                  <Line
                    label={t("lookThrough.envelopeFee")}
                    value={formatCharge(
                      lookThrough.charges.weightedEnvelopeFee,
                    )}
                  />
                ) : null}
                <Line
                  label={t("lookThrough.allIn")}
                  value={formatCharge(lookThrough.charges.weightedAllIn)}
                  strong
                />
                <Line
                  label={t("lookThrough.perYear", { amount: "" }).trim()}
                  value={formatEuro(lookThrough.charges.allInAnnualCost)}
                />
              </dl>
              {/* Which fees these are, and which are not counted — the
                  distinction between a fund's charge and a broker's
                  commission is not obvious from a number. */}
              <p className={cn(MICRO, "mt-3 text-muted-foreground")}>
                {t("lookThrough.chargesNote")}
              </p>
            </Section>
          </StaggerItem>

          {/* Eligibility. */}
          {lookThrough.eligibility.length > 0 ? (
            <StaggerItem className="w-full min-w-0">
              <Section
                icon={<Warning size={ICON.md} weight="light" />}
                title={t("lookThrough.wrappers")}
                tone="warning"
              >
                <ul className="flex flex-col gap-2">
                  {lookThrough.eligibility.map((issue) => (
                    <li key={issue.positionId} className="text-sm">
                      {t("lookThrough.cannotSitHere", {
                        name: issue.name,
                        wallet: INVESTMENT_WALLET_LABELS[issue.walletId],
                      })}
                      <span className="text-muted-foreground">
                        {" "}
                        {t("lookThrough.couldSitIn", {
                          wallets: issue.allowedIn
                            .map((id) => INVESTMENT_WALLET_LABELS[id])
                            .join(" / "),
                        })}
                      </span>
                    </li>
                  ))}
                </ul>
              </Section>
            </StaggerItem>
          ) : null}

          {/* The target. */}
          {target.rows.length > 0 ? (
            <StaggerItem className="w-full min-w-0">
              <Section
                icon={<Target size={ICON.md} weight="light" />}
                title={t("lookThrough.target")}
              >
                <ul className="flex flex-col gap-2">
                  {target.rows.map((row) => {
                    const move = arbitrage.find(
                      (entry) => entry.isin === row.isin,
                    );
                    return (
                      <li
                        key={row.isin}
                        className="flex min-w-0 items-baseline justify-between gap-3"
                      >
                        <span className="min-w-0">
                          <span className="truncate text-sm">{row.name}</span>
                          <span
                            className={cn(MICRO, "ml-2 text-muted-foreground")}
                          >
                            {INVESTMENT_WALLET_LABELS[row.wallet]}
                          </span>
                        </span>
                        <span className="shrink-0 text-right">
                          <span className="text-sm font-semibold tabular-nums">
                            {Math.round(row.weight * 100)}%
                          </span>
                          {move ? (
                            <span
                              className={cn(
                                MICRO,
                                "ml-2",
                                move.delta > 0
                                  ? "text-[var(--success)]"
                                  : "text-[var(--destructive)]",
                              )}
                            >
                              {move.delta > 0
                                ? t("lookThrough.buy", {
                                    amount: formatEuro(Math.abs(move.delta)),
                                  })
                                : t("lookThrough.sell", {
                                    amount: formatEuro(Math.abs(move.delta)),
                                  })}
                            </span>
                          ) : null}
                        </span>
                      </li>
                    );
                  })}
                </ul>
                <p className={cn(MICRO, "mt-3 text-muted-foreground")}>
                  {t("lookThrough.rebalanceNote")}
                </p>
              </Section>
            </StaggerItem>
          ) : null}
        </Stagger>
      </PageContainer>
    </>
  );
}

/**
 * Said out loud when a factsheet did not publish a full breakdown.
 *
 * The shares above are what was published, so they do not add up to the whole
 * fund — and a reader who assumes otherwise will read a 25%-technology
 * portfolio as a 25%-of-what-we-found one, which is a different claim. An
 * earlier version normalised the gap away and turned that same fund into a
 * reported 69% technology; this is the sentence that replaced it.
 */
function PartialAxis({ coverage, rows }: { coverage: number; rows: number }) {
  const t = useT();

  if (rows === 0 || coverage >= AXIS_COVERAGE_FLOOR) {
    return null;
  }

  return (
    <p className={cn(MICRO, "mt-2 text-[var(--warning)]")}>
      {t("lookThrough.caveats.partialAxis", {
        coverage: `${Math.round(coverage * 100)}%`,
      })}
    </p>
  );
}

/** A titled block, the shape every section on this page takes. */
function Section({
  icon,
  title,
  action,
  tone,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  action?: React.ReactNode;
  tone?: "warning";
  children: React.ReactNode;
}) {
  return (
    <Card.Bezel
      className="w-full"
      innerClassName="flex w-full min-w-0 flex-col gap-4 p-5 md:p-6"
    >
      <div className="flex min-w-0 items-center justify-between gap-3">
        <h2 className="flex min-w-0 items-center gap-2 text-sm font-semibold">
          <span
            className={cn(
              "shrink-0",
              tone === "warning"
                ? "text-[var(--warning)]"
                : "text-muted-foreground",
            )}
          >
            {icon}
          </span>
          <span className="min-w-0 truncate">{title}</span>
        </h2>
        {action}
      </div>
      <div className="min-w-0">{children}</div>
    </Card.Bezel>
  );
}

/** A label and a figure on one line. */
function Line({
  label,
  value,
  strong,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd
        className={cn(
          "tabular-nums",
          strong ? "text-sm font-semibold" : "text-sm",
        )}
      >
        {value}
      </dd>
    </div>
  );
}

/**
 * A region's share, next to what the market weighs it at.
 *
 * The factor is the claim worth making. "Thirty per cent France" means
 * nothing on its own; "ten times the market's weight" is the sentence a
 * reader can act on, and it is what the data actually supports.
 */
function Bias({
  label,
  share,
  factor,
}: {
  label: string;
  share: number;
  factor: number | null;
}) {
  const t = useT();

  return (
    <div className="flex flex-col">
      <span className="text-sm font-semibold tabular-nums">
        {Math.round(share * 100)}%
      </span>
      <span className={cn(MICRO, "text-muted-foreground")}>{label}</span>
      {factor !== null && factor > 0 ? (
        <span className={cn(MICRO, "text-muted-foreground")}>
          {/* Within a sixth of the market's weight is "in line": the
              reference itself is approximate, so a tighter claim than that
              would be precision the figure does not have. */}
          {Math.abs(factor - 1) < 0.15
            ? t("lookThrough.inLineWithMarket")
            : t("lookThrough.timesMarket", {
                factor: factor.toFixed(factor < 10 ? 1 : 0),
              })}
        </span>
      ) : null}
    </div>
  );
}

/** A claim, with the app's own figures spliced into it. */
function Segments({ segments }: { segments: ReadSegment[] }) {
  return (
    <>
      {segments.map((segment, index) =>
        segment.kind === "text" ? (
          <span key={index}>{segment.text}</span>
        ) : (
          <span
            key={index}
            title={segment.label}
            className="font-semibold tabular-nums"
          >
            {segment.display}
          </span>
        ),
      )}
    </>
  );
}

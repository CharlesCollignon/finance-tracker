import { useMemo, useState } from "react";
import { View } from "react-native";
import { useRouter, type Href } from "expo-router";
import { describePullAge } from "@finance/core/bank-pull";
import { countryFlag, countryName } from "@finance/core/country-names";
import { formatCharge } from "@finance/core/fund-costs";
import {
  drainStep,
  haltIsInstrumentSpecific,
  type DrainHalt,
} from "@finance/core/instrument-reading";
import { INVESTMENT_WALLET_LABELS } from "@finance/core/investments";
import {
  HOLDING_KIND_LABELS,
  holdingsWorthShowing,
  type HoldingKind,
} from "@finance/core/look-through";
import { buildArbitrage } from "@finance/core/look-through-target";
import { factsDigest } from "@finance/core/month-facts";
import { exactModelLabel } from "@finance/core/model-name";
import { BylineMark, WriterMark } from "@/components/AiMark";
import {
  renderWalletRead,
  targetFromWalletRead,
  walletReadFooting,
} from "@finance/core/wallet-read";
import { walletReadsRemaining } from "@finance/core/wallet-read-budget";
import type { Key } from "@finance/core/i18n/t";
import { ConnectAiInvite } from "@/components/ConnectAiInvite";
import { PrivateAmount } from "@/components/PrivateAmount";
import { StaggerItem } from "@/components/motion/Stagger";
import { StatHero } from "@/components/StatHero";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Text } from "@/components/ui/Text";
import { cn } from "@/lib/cn";
import { hapticSuccess } from "@/lib/haptics";
import {
  readInstrumentThroughWeb,
  reviewWallets,
  type LookThroughData,
} from "@/lib/look-through-data";
import { useFormatCurrency } from "@/providers/CurrencyProvider";
import { useLocale, useT } from "@/providers/LocaleProvider";
import { useToast } from "@/providers/ToastProvider";
import { ICON } from "@/theme/tokens";
import { useThemeColors } from "@/theme/useThemeColors";
import { WeightBars } from "./WeightBars";
import {
  Bias,
  Line,
  PartialAxis,
  Section,
  Segments,
  ToneDot,
  Uncovered,
  sectorLabel,
  share,
} from "@/components/look-through/parts";

/** What to say when a walk down the queue stops early — the web's map. */
const HALT_MESSAGES: Record<Exclude<DrainHalt, "done">, Key> = {
  cooling: "lookThrough.halt.cooling",
  allowance: "lookThrough.halt.allowance",
  "not-yours": "lookThrough.halt.notYours",
  "no-reader": "lookThrough.halt.noReader",
  "not-set-up": "lookThrough.halt.notSetUp",
  "no-search": "lookThrough.halt.noSearch",
  "provider-down": "lookThrough.halt.providerDown",
  "nothing-found": "lookThrough.halt.nothingFound",
  "wrong-instrument": "lookThrough.halt.wrongInstrument",
  "signed-out": "lookThrough.halt.signedOut",
};

/**
 * What the wallets are made of — the web's `LookThroughView`, on a phone.
 *
 * The same sections in the same order: the value and what it costs a year,
 * then what the app could not see (before anything it can, since a reader who
 * does not know that two fifths of their money is unclassified will read every
 * figure below as the whole), the wallet read, where the money is, what it is
 * in, where it doubles up, the charges, what sits in the wrong wrapper, and a
 * target to aim at.
 */
export function LookThroughView({ data }: { data: LookThroughData }) {
  const t = useT();
  const colors = useThemeColors();
  const locale = useLocale();
  const formatEuro = useFormatCurrency();
  const router = useRouter();
  const { toast } = useToast();
  const [reviewing, setReviewing] = useState(false);
  const [reading, setReading] = useState(false);
  // What the walk has brought the count down to; the data's own queue until
  // a walk starts, and again after the reload that follows it.
  const [walked, setWalked] = useState<{
    queue: string[];
    remaining: number;
  } | null>(null);
  const remaining =
    walked && walked.queue === data.queue
      ? walked.remaining
      : data.queue.length;

  const { lookThrough, stored } = data;
  // Pluclair's model or the user's own, and whether anyone can write now.
  const writerBrand = data.writer.name;
  const account = data.writer.account;
  const canReview = data.writer.writable && data.readsTracked;

  // The read's own target when it proposed one, the app's otherwise — the
  // web page's rule, so the surface always has a target to show.
  const target = useMemo(() => {
    const fromRead = stored?.read ? targetFromWalletRead(stored.read) : null;
    return fromRead && fromRead.rows.length > 0 ? fromRead : data.defaultTarget;
  }, [stored, data.defaultTarget]);

  // Re-rendered against today's figures, in the language it was written in.
  const rendered = useMemo(
    () =>
      stored?.read
        ? renderWalletRead(stored.read, data.facts, formatEuro, stored.locale)
        : null,
    [stored, data.facts, formatEuro],
  );
  const stale =
    stored?.read && stored.factsDigest !== null
      ? stored.factsDigest !== factsDigest(data.facts)
      : false;
  const readAt = stored?.readAt
    ? describePullAge(stored.readAt, new Date().toISOString(), locale)
    : null;
  const readsLeft = walletReadsRemaining(stored?.tally ?? null);
  const footing = walletReadFooting(data.facts, locale);

  const arbitrage = useMemo(
    () =>
      buildArbitrage(
        target,
        data.positions.map((position) => ({
          isin: position.isin,
          name: position.name,
          walletId: position.walletId,
          marketValue: position.marketValue,
        })),
        lookThrough.totalValue,
      ),
    [target, data.positions, lookThrough.totalValue],
  );

  const unclassified = lookThrough.caveats.find(
    (caveat) => caveat.kind === "unclassified",
  );
  // The condition the server refuses a read on, checked here so the button
  // can say so in advance instead of spending a press on it.
  const canSayAnything =
    lookThrough.classifiedValue > 0 &&
    lookThrough.countries.length + lookThrough.sectors.length > 0;

  async function onReview() {
    setReviewing(true);
    const outcome = await reviewWallets();
    setReviewing(false);
    if (outcome.read) {
      void hapticSuccess();
    }
    if (outcome.message) {
      toast(outcome.message, outcome.read ? "success" : "error");
    }
  }

  function nameOf(isin: string): string {
    return data.positions.find((row) => row.isin === isin)?.name ?? isin;
  }

  /**
   * Walk the queue one instrument at a time, as the web does: sequential,
   * one request each, so the count goes down in front of the reader. The
   * decision about each answer is `drainStep`'s. An instrument nothing could
   * be found for is left behind and the walk asks for the one after it; the
   * other halts are about the reader and stop the walk.
   */
  async function onReadAll() {
    setReading(true);
    const queue = data.queue;
    const giveUpOn = new Set<string>();
    let left = [...queue];
    let readCount = 0;

    try {
      for (;;) {
        const pending = left.filter((isin) => !giveUpOn.has(isin));
        const next = pending[0];
        if (next === undefined) {
          break;
        }

        const status = await readInstrumentThroughWeb(next);
        const moved = status === "read" || status === "already-fresh";
        if (moved) {
          readCount += 1;
          left = left.filter((isin) => isin !== next);
        }
        const count = moved ? pending.length - 1 : pending.length;
        setWalked({ queue, remaining: count });

        const step = drainStep(status, count);
        if (step.go) {
          continue;
        }
        if (step.halt === "done") {
          break;
        }
        if (haltIsInstrumentSpecific(step.halt)) {
          giveUpOn.add(next);
          setWalked({ queue, remaining: count - 1 });
          continue;
        }

        toast(
          t(HALT_MESSAGES[step.halt], {
            model: writerBrand,
            name: nameOf(next),
          }),
          "error",
        );
        return;
      }

      // Said once, at the end: a walk down a portfolio is one action.
      if (giveUpOn.size === 0) {
        toast(
          t("lookThrough.readRest.allRead", { count: readCount }),
          "success",
        );
      } else if (readCount === 0) {
        toast(
          t("lookThrough.readRest.noneRead", { count: giveUpOn.size }),
          "error",
        );
      } else {
        toast(
          t("lookThrough.readRest.someSkipped", {
            count: giveUpOn.size,
            read: readCount,
          }),
        );
      }
    } finally {
      // Each reading announced itself as it landed, so the figures have been
      // following the walk down; nothing is left to reload here.
      setReading(false);
    }
  }

  if (lookThrough.totalValue <= 0) {
    return (
      <EmptyState
        title={t("lookThrough.title")}
        description={t("lookThrough.caveats.noMarketValue")}
      />
    );
  }

  return (
    <View className="gap-5">
      <StaggerItem index={0}>
        <StatHero
          label={t("lookThrough.readCoverage", {
            share: share(lookThrough.classifiedShare, locale),
          })}
          amount={formatEuro(lookThrough.totalValue)}
          subtitle={
            // The euro the charges come to, under the value they are charged
            // on; the ratio is the explanation, the amount is the thing.
            lookThrough.charges.weightedAllIn !== null ? (
              <>
                <PrivateAmount className="text-sm font-medium text-destructive">
                  {t("lookThrough.costPerYear", {
                    amount: formatEuro(lookThrough.charges.allInAnnualCost),
                  })}
                </PrivateAmount>
                {`\n${t("lookThrough.costAllIn", {
                  rate: formatCharge(lookThrough.charges.weightedAllIn, locale),
                })}`}
              </>
            ) : undefined
          }
        />
      </StaggerItem>

      {unclassified?.kind === "unclassified" ? (
        <StaggerItem index={1}>
          <Section
            icon="eye-outline"
            title={t("lookThrough.caveats.notCovered")}
            tone="warning"
          >
            <Text variant="muted" className="text-sm">
              {t("lookThrough.caveats.unclassified", {
                share: share(unclassified.share, locale),
              })}
            </Text>

            <Uncovered
              when={lookThrough.unidentifiedPositions.length > 0}
              heading={t("lookThrough.caveats.noIsin")}
              body={t("lookThrough.caveats.noIsinBody", {
                count: lookThrough.unidentifiedPositions.length,
              })}
              rows={lookThrough.unidentifiedPositions}
            >
              <Button
                label={t("lookThrough.caveats.goToPositions")}
                variant="outline"
                size="sm"
                className="self-start"
                onPress={() => {
                  if (router.canGoBack()) {
                    router.back();
                  } else {
                    router.replace("/investments" as Href);
                  }
                }}
              />
            </Uncovered>

            <Uncovered
              when={remaining > 0}
              heading={t("lookThrough.caveats.neverRead")}
              body={t("lookThrough.caveats.neverReadBody", {
                count: remaining,
              })}
              rows={lookThrough.unreadPositions}
            >
              {data.writer.writable ? (
                <Button
                  label={
                    reading
                      ? t("lookThrough.readingOne")
                      : t("lookThrough.readAll")
                  }
                  variant="outline"
                  size="sm"
                  icon="refresh-outline"
                  className="self-start"
                  disabled={reading}
                  onPress={() => {
                    void onReadAll();
                  }}
                />
              ) : null}
            </Uncovered>

            <Uncovered
              when={lookThrough.readButUnclassifiedPositions.length > 0}
              heading={t("lookThrough.caveats.readNothingUseful")}
              body={t("lookThrough.caveats.readNothingUsefulBody", {
                count: lookThrough.readButUnclassifiedPositions.length,
              })}
              rows={lookThrough.readButUnclassifiedPositions}
            />

            <Uncovered
              when={lookThrough.unresolvablePositions.length > 0}
              heading={t("lookThrough.caveats.unresolvableHeading")}
              body={t("lookThrough.caveats.unresolvable", {
                count: lookThrough.unresolvablePositions.length,
              })}
              rows={lookThrough.unresolvablePositions}
            />
          </Section>
        </StaggerItem>
      ) : null}

      <StaggerItem index={2}>
        <Section icon="library-outline" title={t("lookThrough.title")}>
          {canReview ? (
            <Button
              label={
                reviewing
                  ? t("walletRead.reviewing")
                  : t("walletRead.review", { model: writerBrand })
              }
              size="sm"
              leading={
                <WriterMark
                  model={writerBrand}
                  size={ICON.md}
                  color={colors.primaryForeground}
                />
              }
              className="self-start"
              // Nothing classified means the read would be refused; the
              // reason is stated below rather than spent on a press.
              disabled={reviewing || !canSayAnything}
              onPress={() => {
                void onReview();
              }}
            />
          ) : !account ? (
            <ConnectAiInvite />
          ) : null}

          {rendered === null ? (
            <View className="gap-1">
              <Text className="text-sm font-medium">
                {t("walletRead.empty")}
              </Text>
              <Text variant="muted" className="text-sm">
                {canSayAnything
                  ? t("walletRead.emptyBody")
                  : t("lookThrough.caveats.needsAReading")}
              </Text>
            </View>
          ) : (
            <View className="gap-4">
              <View className="flex-row flex-wrap items-center gap-x-3 gap-y-1">
                {readAt ? (
                  <Text variant="micro">
                    {t("walletRead.readAt", { when: readAt })}
                  </Text>
                ) : null}
                <View className="flex-row items-center gap-1">
                  <BylineMark model={stored?.model ?? null} />
                  <Text variant="micro">
                    {stored?.model
                      ? t("walletRead.writtenBy", {
                          model: exactModelLabel(stored.model),
                        })
                      : t("walletRead.writtenByUnknown")}
                  </Text>
                </View>
                {stale ? (
                  <Badge
                    label={t("walletRead.stale")}
                    size="sm"
                    variant="outline"
                  />
                ) : null}
                {canReview && !account ? (
                  <Text variant="micro">
                    {t("walletRead.reviewHint", { remaining: readsLeft })}
                  </Text>
                ) : null}
              </View>

              <Text className="text-base font-semibold">
                <Segments segments={rendered.headline} />
              </Text>

              <View className="gap-3">
                {rendered.observations.map((row, index) => (
                  <View key={index} className="flex-row gap-2">
                    <ToneDot tone={row.tone} />
                    <Text className="min-w-0 flex-1 text-sm">
                      <Segments segments={row.segments} />
                    </Text>
                  </View>
                ))}
              </View>

              {rendered.suggestions.length > 0 ? (
                <View className="gap-3 border-t border-border pt-4">
                  {rendered.suggestions.map((row) => (
                    <View key={row.isin} className="gap-1">
                      <View className="flex-row flex-wrap items-center gap-2">
                        <Text className="text-sm font-semibold">
                          {row.name}
                        </Text>
                        <Badge label={row.symbol} size="sm" variant="outline" />
                        <Badge
                          label={INVESTMENT_WALLET_LABELS[row.wallet]}
                          size="sm"
                        />
                      </View>
                      <Text variant="muted" className="text-sm">
                        <Segments segments={row.segments} />
                      </Text>
                    </View>
                  ))}
                </View>
              ) : null}
            </View>
          )}

          <View className="gap-1 border-t border-border pt-3">
            {footing.map((line) => (
              <Text key={line} variant="micro">
                {line}
              </Text>
            ))}
          </View>
        </Section>
      </StaggerItem>

      {/* What the money is in, over everything held: the one place crypto
          and gold stand beside the funds rather than outside them. */}
      {holdingsWorthShowing(lookThrough) ? (
        <StaggerItem index={3}>
          <Section icon="layers-outline" title={t("lookThrough.holdings")}>
            <WeightBars
              rows={lookThrough.holdings.map((row) => ({
                id: row.id,
                label: t(HOLDING_KIND_LABELS[row.id as HoldingKind]),
                weight: row.weight,
              }))}
              // Six kinds at most, all on their own line: nothing is pooled.
              restLabel={() => ""}
              showRestLabel={t("lookThrough.showRest")}
              hideRestLabel={t("lookThrough.hideRest")}
            />
            <Text variant="micro">{t("lookThrough.holdingsNote")}</Text>
          </Section>
        </StaggerItem>
      ) : null}

      {lookThrough.countries.length > 0 ? (
        <StaggerItem index={3}>
          <Section icon="globe-outline" title={t("lookThrough.geography")}>
            <WeightBars
              rows={lookThrough.countries.map((row) => ({
                id: row.id,
                label: countryName(row.id, locale),
                mark: countryFlag(row.id),
                weight: row.weight,
              }))}
              restLabel={(count) => t("lookThrough.restCountries", { count })}
              showRestLabel={t("lookThrough.showRest")}
              hideRestLabel={t("lookThrough.hideRest")}
            />
            <View className="flex-row gap-3 border-t border-border pt-3">
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
            </View>
            <Text variant="micro">
              {t("lookThrough.caveats.geographyIsNotCurrency")}
            </Text>
            <PartialAxis
              coverage={lookThrough.countryCoverage}
              rows={lookThrough.countries.length}
            />
          </Section>
        </StaggerItem>
      ) : null}

      {lookThrough.sectors.length > 0 ? (
        <StaggerItem index={4}>
          <Section icon="pie-chart-outline" title={t("lookThrough.sectors")}>
            <WeightBars
              rows={lookThrough.sectors.map((row) => ({
                id: row.id,
                label: sectorLabel(t, row.id, row.label),
                weight: row.weight,
              }))}
              restLabel={(count) => t("lookThrough.restSectors", { count })}
              showRestLabel={t("lookThrough.showRest")}
              hideRestLabel={t("lookThrough.hideRest")}
            />
            <PartialAxis
              coverage={lookThrough.sectorCoverage}
              rows={lookThrough.sectors.length}
            />
          </Section>
        </StaggerItem>
      ) : null}

      {lookThrough.indexCollisions.length > 0 ? (
        <StaggerItem index={5}>
          <Section
            icon="copy-outline"
            title={t("lookThrough.doublingUp")}
            tone="warning"
          >
            <View className="gap-3">
              {lookThrough.indexCollisions.map((collision) => (
                <View key={collision.positionIds.join("-")} className="gap-0.5">
                  <Text className="text-sm font-medium">
                    {`${collision.names[0]} · ${collision.names[1]}`}
                  </Text>
                  <Text variant="micro">
                    {collision.identical
                      ? t("lookThrough.sameIndex", {
                          index: collision.indexes[0],
                        })
                      : t("lookThrough.nestedIndex", {
                          outer: collision.indexes[0],
                          inner: collision.indexes[1],
                        })}
                  </Text>
                </View>
              ))}
            </View>

            {lookThrough.constituentOverlaps.length > 0 ? (
              <View className="gap-2 border-t border-border pt-3">
                {lookThrough.constituentOverlaps.map((overlap) => (
                  <Text key={overlap.positionIds.join("-")} className="text-sm">
                    {t("lookThrough.sharedCompanies", {
                      count: overlap.sharedNames.length,
                      other: overlap.names[1],
                    })}
                    <Text variant="muted" className="text-sm">
                      {` — ${overlap.sharedNames.slice(0, 5).join(", ")}`}
                    </Text>
                  </Text>
                ))}
                {/* The limit travels with the figure, always. */}
                <Text variant="micro">
                  {t("lookThrough.caveats.overlapIsAFloor")}
                </Text>
              </View>
            ) : null}
          </Section>
        </StaggerItem>
      ) : null}

      <StaggerItem index={6}>
        <Section icon="cash-outline" title={t("lookThrough.charges")}>
          <View className="gap-2">
            <Line
              label={t("lookThrough.fundCharges")}
              value={formatCharge(lookThrough.charges.weightedAverage, locale)}
            />
            {lookThrough.charges.weightedEnvelopeFee !== null ? (
              <Line
                label={t("lookThrough.envelopeFee")}
                value={formatCharge(
                  lookThrough.charges.weightedEnvelopeFee,
                  locale,
                )}
              />
            ) : null}
            <Line
              label={t("lookThrough.allIn")}
              value={formatCharge(lookThrough.charges.weightedAllIn, locale)}
              strong
            />
            <Line
              label={t("lookThrough.perYear", { amount: "" }).trim()}
              value={formatEuro(lookThrough.charges.allInAnnualCost)}
              money
            />
          </View>
          <Text variant="micro">{t("lookThrough.chargesNote")}</Text>
        </Section>
      </StaggerItem>

      {lookThrough.eligibility.length > 0 ? (
        <StaggerItem index={7}>
          <Section
            icon="alert-circle-outline"
            title={t("lookThrough.wrappers")}
            tone="warning"
          >
            <View className="gap-2">
              {lookThrough.eligibility.map((issue) => (
                <Text key={issue.positionId} className="text-sm">
                  {t("lookThrough.cannotSitHere", {
                    name: issue.name,
                    wallet: INVESTMENT_WALLET_LABELS[issue.walletId],
                  })}
                  <Text variant="muted" className="text-sm">
                    {` ${t("lookThrough.couldSitIn", {
                      wallets: issue.allowedIn
                        .map((id) => INVESTMENT_WALLET_LABELS[id])
                        .join(" / "),
                    })}`}
                  </Text>
                </Text>
              ))}
            </View>
          </Section>
        </StaggerItem>
      ) : null}

      {target.rows.length > 0 ? (
        <StaggerItem index={8}>
          <Section icon="locate-outline" title={t("lookThrough.target")}>
            <View className="gap-3">
              {target.rows.map((row) => {
                const move = arbitrage.find((entry) => entry.isin === row.isin);
                return (
                  <View
                    key={row.isin}
                    className="flex-row items-baseline justify-between gap-3"
                  >
                    <View className="min-w-0 flex-1">
                      <Text numberOfLines={1} className="text-sm">
                        {row.name}
                      </Text>
                      <Text variant="micro">
                        {INVESTMENT_WALLET_LABELS[row.wallet]}
                      </Text>
                    </View>
                    <View className="shrink-0 items-end">
                      <Text className="font-sans tabular-nums text-sm font-semibold">
                        {share(row.weight, locale)}
                      </Text>
                      {move ? (
                        <PrivateAmount
                          className={cn(
                            "text-xs",
                            move.delta > 0
                              ? "text-success"
                              : "text-destructive",
                          )}
                        >
                          {move.delta > 0
                            ? t("lookThrough.buy", {
                                amount: formatEuro(Math.abs(move.delta)),
                              })
                            : t("lookThrough.sell", {
                                amount: formatEuro(Math.abs(move.delta)),
                              })}
                        </PrivateAmount>
                      ) : null}
                    </View>
                  </View>
                );
              })}
            </View>
            <Text variant="micro">{t("lookThrough.rebalanceNote")}</Text>
          </Section>
        </StaggerItem>
      ) : null}
    </View>
  );
}

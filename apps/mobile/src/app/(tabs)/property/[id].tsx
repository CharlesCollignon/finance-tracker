import { useState, useSyncExternalStore, type ReactNode } from "react";
import { Pressable, RefreshControl, ScrollView, View } from "react-native";
import Animated, { useReducedMotion, ZoomIn } from "react-native-reanimated";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { parseTypedAmount } from "@finance/core/amount-input";
import {
  formatPercentLabel,
  formatShortDate,
  todayIsoLocal,
} from "@finance/core/constants";
import { resolveMessage } from "@finance/core/i18n/t";
import {
  cents,
  loanSchedule,
  loanTotals,
  nextPayment,
  outstandingOn,
  type LoanPayment,
} from "@finance/core/loan-schedule";
import {
  loanDebits,
  loanPaymentCategoryName,
  loanTermsFromRow,
  paymentShare,
  propertyPosition,
  templatesLike,
  valueSourceLine,
} from "@finance/core/property";
import { formatRecurrenceSchedule } from "@finance/core/recurrence";
import { equityMoment, loanMoment } from "@finance/core/property-moments";
import { loanProgress, ownership } from "@finance/core/property-progress";
import { isLet } from "@finance/core/rental";
import { formatRate } from "@finance/core/savings-accounts";
import type { PropertyLoan } from "@finance/core/types/database";

import {
  Field,
  monthAndYear,
  PROPERTY_KIND_KEYS,
  PROPERTY_USAGE_KEYS,
  TextField,
} from "@/components/property/fields";
import { AnimatedAmount } from "@/components/AnimatedAmount";
import { FadeIn } from "@/components/motion/FadeIn";
import { StaggerItem } from "@/components/motion/Stagger";
import { LoanTrack, OwnershipBar, PaymentBar } from "@/components/property/ProgressBars";
import { JointDeed, type JointDeedView } from "@/components/property/JointDeed";
import { EditPropertySheet, LoanSheet } from "@/components/property/PropertySheets";
import { RentalSection } from "@/components/property/RentalSection";
import { PrivateAmount } from "@/components/PrivateAmount";
import { ScreenError } from "@/components/ScreenError";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ChipRow } from "@/components/ui/ChipRow";
import { ConfirmSheet } from "@/components/ui/ConfirmSheet";
import { DateField } from "@/components/ui/DateField";
import { EmptyState } from "@/components/ui/EmptyState";
import { Screen } from "@/components/ui/Screen";
import { ScreenSkeleton } from "@/components/ui/Skeleton";
import { Text } from "@/components/ui/Text";
import { useRefreshable } from "@/hooks/useRefreshable";
import { hapticSuccess, hapticWarning } from "@/lib/haptics";
import { useMomentSeen } from "@/lib/moments";
import {
  addLoanPayment,
  getProperties,
  getPropertyShares,
  isReadingMarket,
  linkLoanTemplate,
  removeLoan,
  removeProperty,
  setKnownOutstanding,
  setOwnValue,
  subscribeToReadings,
  syncLoanPayment,
  type AttachedTemplate,
} from "@/lib/properties";
import { useOwner } from "@/providers/OwnerProvider";
import { useFormatCurrency } from "@/providers/CurrencyProvider";
import { useLocale, useT } from "@/providers/LocaleProvider";
import { useToast } from "@/providers/ToastProvider";
import { ICON } from "@/theme/tokens";
import { useTabBarClearance } from "@/theme/chrome";
import { useThemeColors } from "@/theme/useThemeColors";

type Result = { success?: boolean; error?: string };

/**
 * One property: what it is worth to the user and on whose word, each loan
 * behind it with its next payment and its schedule, and the recurring
 * entries attached to it. The web's `/property/[id]`, on the phone.
 */
export default function PropertyDetailScreen() {
  const t = useT();
  const locale = useLocale();
  const router = useRouter();
  const format = useFormatCurrency();
  const tabBarClearance = useTabBarClearance();
  const { toast } = useToast();
  // The person's homes, or their space's under « Commun ».
  const { ownerId, userId, space, joint } = useOwner();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [editing, setEditing] = useState(false);
  const [loanSheet, setLoanSheet] = useState<{ loan: PropertyLoan | null } | null>(
    null,
  );
  const [removing, setRemoving] = useState(false);
  const [removePending, setRemovePending] = useState(false);
  const { data, loading, refreshing, onRefreshAll, onRefresh, error } = useRefreshable(
    async () => (ownerId ? getProperties(ownerId) : null),
    [ownerId],
    // Categories too: an entry attached to it is named by its category.
    { reads: ["properties", "templates", "categories"] },
  );
  // This phone is asking the web server for its market reading right now.
  const readingNow = useSyncExternalStore(subscribeToReadings, () =>
    isReadingMarket(id),
  );

  const detail = data?.properties.find(({ property }) => property.id === id) ?? null;

  // A home the space owns: each partner's part of the deed, the space's
  // split until it is set (6c).
  const { data: deedShares } = useRefreshable(
    async () => (joint && id ? (await getPropertyShares([id])).get(id) ?? null : null),
    [joint, id],
    { reads: ["properties"] },
  );
  const self = space?.members.find((member) => member.userId === userId);
  const partner = space?.members.find((member) => member.userId !== userId);
  const deed: JointDeedView | null =
    joint && space && userId
      ? {
          mine: deedShares?.get(userId) ?? self?.share ?? 0.5,
          selfName: self?.name ?? "",
          partnerName: partner?.name ?? "",
        }
      : null;
  const today = todayIsoLocal();

  // Back to the list — or to it, when the property was opened from
  // elsewhere and there is nothing under it in this tab.
  const back = {
    label: t("property.backToList"),
    onPress: () =>
      router.canGoBack() ? router.back() : router.replace("/property"),
  };

  async function confirmRemove() {
    if (!detail) {
      return;
    }
    setRemovePending(true);
    const result = await removeProperty(detail.property.id);
    setRemovePending(false);
    setRemoving(false);
    if (!result.success) {
      void hapticWarning();
      toast(resolveMessage(t, result.error), "error");
      return;
    }
    void hapticSuccess();
    toast(t("property.removed", { name: detail.property.name }));
    router.back();
  }

  if (loading && !data) {
    return (
      <Screen title={t("nav.property")} back={back}>
        <ScreenSkeleton rows={3} />
      </Screen>
    );
  }
  if (error) {
    return (
      <Screen title={t("nav.property")} back={back}>
        <ScreenError message={error} onRetry={onRefresh} />
      </Screen>
    );
  }
  if (!detail) {
    return (
      <Screen title={t("nav.property")} back={back}>
        <EmptyState title={t("errors.notFound")} description={t("property.backToList")} />
      </Screen>
    );
  }

  const { property, loans, templates } = detail;
  const position = propertyPosition(property, loans, today, detail.market);
  const halfYours = equityMoment(property, loans, detail.market, today);
  const reading = detail.market.reading;
  const source = position.estimate.source;
  const partOwned = property.ownership_share < 1;
  const attached = templates.filter((template) => template.attached);

  return (
    <Screen title={property.name} back={back}>
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefreshAll} />}
        contentContainerClassName="gap-5 pt-2"
        // Under the tab bar now, as every tab's screen is.
        contentContainerStyle={{ paddingBottom: tabBarClearance }}
      >
        <StaggerItem index={0}>
        <Card bezel innerClassName="gap-5">
          <View className="items-center gap-1">
            <Text variant="muted" className="text-center text-xs">
              {[
                t(PROPERTY_KIND_KEYS[property.kind]),
                t(PROPERTY_USAGE_KEYS[property.usage]),
                property.living_area ? `${property.living_area} m²` : null,
                property.postcode,
              ]
                .filter(Boolean)
                .join(" · ")}
            </Text>
            <Text variant="muted" className="mt-2 text-xs">
              {t("property.netValue")}
            </Text>
            <AnimatedAmount
              value={position.netValue}
              format={format}
              className="text-3xl font-semibold"
            />
            {partOwned ? (
              <Text variant="muted" className="text-xs">
                {t("property.forYourShare", {
                  share: formatPercentLabel(property.ownership_share * 100, locale),
                })}
              </Text>
            ) : null}
            {halfYours ? (
              <View className="mt-1">
                <MomentPill
                  seenKey={`equity-half:${property.id}`}
                  label={t("property.momentEquityHalf")}
                />
              </View>
            ) : null}
          </View>

          <OwnershipBar ownership={ownership(position)} detailed />
          {deed ? <JointDeed propertyId={property.id} deed={deed} /> : null}

          <View className="flex-row flex-wrap gap-y-4">
            <Fact label={t("property.estimatedValue")}>
              <AnimatedAmount
                value={position.estimate.value}
                format={format}
                className="text-sm font-medium"
              />
              {position.estimate.low !== null && position.estimate.high !== null ? (
                <PrivateAmount className="text-xs">
                  {t("property.valueRange", {
                    low: format(position.estimate.low),
                    high: format(position.estimate.high),
                  })}
                </PrivateAmount>
              ) : null}
              {readingNow ? (
                <View accessibilityRole="text" className="flex-row items-center gap-1.5">
                  <View className="h-1.5 w-1.5 rounded-full bg-primary" />
                  <Text variant="muted" className="text-xs">
                    {t("property.readingNow")}
                  </Text>
                </View>
              ) : (
                <FadeIn key={valueSourceLine(source, locale)}>
                  <Text variant="muted" className="text-xs">
                    {valueSourceLine(source, locale)}
                  </Text>
                </FadeIn>
              )}
            </Fact>
            {reading ? (
              <Fact label={t("property.pricePerM2")}>
                <PrivateAmount className="text-sm font-medium">
                  {t("property.pricePerM2Line", {
                    median: format(reading.medianM2),
                    low: format(reading.q1M2),
                    high: format(reading.q3M2),
                  })}
                </PrivateAmount>
              </Fact>
            ) : null}
            {partOwned ? (
              <Fact label={t("property.yourValue")}>
                <PrivateAmount className="text-sm font-medium">
                  {format(position.value)}
                </PrivateAmount>
              </Fact>
            ) : null}
            <Fact label={t("property.owed")}>
              <PrivateAmount className="text-sm font-medium">
                {format(position.owed)}
              </PrivateAmount>
            </Fact>
            <Fact label={t("property.cost")}>
              <PrivateAmount className="text-sm font-medium">
                {format(position.cost)}
              </PrivateAmount>
            </Fact>
            <Fact label={t("property.gain")}>
              <PrivateAmount className="text-sm font-medium">
                {format(position.unrealisedGain)}
              </PrivateAmount>
            </Fact>
            {loans.length > 0 ? (
              <Fact label={t("property.principalRepaid")}>
                <PrivateAmount className="text-sm font-medium">
                  {format(position.principalRepaid)}
                </PrivateAmount>
              </Fact>
            ) : null}
          </View>

          <View className="gap-3 border-t border-border pt-4">
            <Button
              label={t("property.edit")}
              variant="outline"
              size="sm"
              onPress={() => setEditing(true)}
            />
            <OwnValueEditor
              label={
                source.kind === "own" ? t("property.ownValueChange") : t("property.ownValueSet")
              }
              hasOwn={source.kind === "own"}
              save={(value) => setOwnValue(property.id, value)}
            />
          </View>
        </Card>
        </StaggerItem>

        {isLet(property.usage) ? (
          <StaggerItem index={1}>
            <RentalSection detail={detail} position={position} today={today} />
          </StaggerItem>
        ) : null}

        <StaggerItem index={2}>
        <View className="gap-3">
          <Text className="font-semibold" style={{ fontSize: 17 }}>
            {t("property.loansTitle")}
          </Text>
          {loans.length === 0 ? (
            <Text variant="muted">{t("property.noLoans")}</Text>
          ) : (
            loans.map((loan) => (
              <LoanCard
                key={loan.id}
                loan={loan}
                propertyName={property.name}
                template={templates.find(
                  (template) => template.id === loan.recurring_template_id,
                )}
                insuranceTemplate={templates.find(
                  (template) => template.id === loan.insurance_template_id,
                )}
                looseTemplates={data?.looseTemplates ?? []}
                today={today}
                onEdit={() => setLoanSheet({ loan })}
              />
            ))
          )}
          <Button
            label={t("property.addLoan")}
            variant="outline"
            onPress={() => setLoanSheet({ loan: null })}
          />
        </View>
        </StaggerItem>

        <StaggerItem index={3}>
        <View className="gap-3">
          <Text className="font-semibold" style={{ fontSize: 17 }}>
            {t("property.templatesTitle")}
          </Text>
          {attached.length === 0 ? (
            <Text variant="muted">{t("property.templatesNone")}</Text>
          ) : (
            <Card innerClassName="p-0">
              {attached.map((template, index) => (
                <TemplateRow key={template.id} template={template} first={index === 0} />
              ))}
            </Card>
          )}
          <Pressable
            accessibilityRole="link"
            onPress={() => router.push("/recurring")}
            className="min-h-11 justify-center self-start"
          >
            <Text variant="muted">{t("property.templatesManage")}</Text>
          </Pressable>
        </View>
        </StaggerItem>

        <Button
          label={t("property.removeProperty")}
          variant="ghost"
          onPress={() => setRemoving(true)}
        />
      </ScrollView>

      <EditPropertySheet property={property} open={editing} onClose={() => setEditing(false)} />
      <LoanSheet
        key={loanSheet?.loan?.id ?? "new"}
        propertyId={property.id}
        propertyName={property.name}
        loan={loanSheet?.loan ?? null}
        open={loanSheet !== null}
        onClose={() => setLoanSheet(null)}
      />
      <ConfirmSheet
        open={removing}
        title={t("property.removeProperty")}
        message={t("property.removePropertyConfirm", { name: property.name })}
        confirmLabel={t("property.removeProperty")}
        pending={removePending}
        onConfirm={() => void confirmRemove()}
        onCancel={() => setRemoving(false)}
      />
    </Screen>
  );
}

function LoanCard({
  loan,
  propertyName,
  template,
  insuranceTemplate,
  looseTemplates,
  today,
  onEdit,
}: {
  loan: PropertyLoan;
  propertyName: string;
  template: AttachedTemplate | undefined;
  /** Its insurance's own entry, when the insurance is debited apart. */
  insuranceTemplate: AttachedTemplate | undefined;
  /** Monthly expense entries no loan stands on, to offer for linking. */
  looseTemplates: readonly AttachedTemplate[];
  today: string;
  onEdit: () => void;
}) {
  const t = useT();
  const locale = useLocale();
  const format = useFormatCurrency();
  const { toast } = useToast();
  const [showSchedule, setShowSchedule] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [removePending, setRemovePending] = useState(false);
  const terms = loanTermsFromRow(loan);
  const schedule = loanSchedule(terms);
  const share = loan.borrower_share;
  const next = nextPayment(schedule, today);
  const totals = loanTotals(schedule, loan.fees);
  const owed = cents(outstandingOn(terms, schedule, today) * share);
  const split = next ? paymentShare(next, share) : null;
  // What each debit should say: one amount, or — the insurance debited
  // apart — the payment and the insurance on their own.
  const separate = loan.insurance_separate && (split?.insurance ?? 0) > 0;
  const expected = split
    ? loanDebits(
        { payment: split.total - split.insurance, insurance: split.insurance },
        1,
        separate,
      )
    : null;
  const mismatch =
    debitDrifts(template, expected?.payment ?? null, totals.endsOn) ||
    (separate && debitDrifts(insuranceTemplate, expected?.insurance ?? null, totals.endsOn));
  const missing = !template || (separate && !insuranceTemplate);
  const moment = loanMoment(loan, today);
  const length =
    loan.months % 12 === 0
      ? t("property.yearsCount", { count: loan.months / 12 })
      : t("units.months", { value: loan.months });

  async function confirmRemove() {
    setRemovePending(true);
    const result = await removeLoan(loan.id);
    setRemovePending(false);
    setRemoving(false);
    if (!result.success) {
      void hapticWarning();
      toast(resolveMessage(t, result.error), "error");
      return;
    }
    void hapticSuccess();
  }

  return (
    <Card bezel innerClassName="gap-4">
      <View className="gap-0.5">
        <View className="flex-row flex-wrap items-center gap-2">
          <Text className="font-semibold">{loan.label}</Text>
          {moment ? (
            <MomentPill
              seenKey={`${moment.kind}:${loan.id}`}
              label={
                moment.kind === "half" ? t("property.momentHalf") : t("property.momentLast")
              }
            />
          ) : null}
        </View>
        <PrivateAmount className="text-xs text-muted-foreground">
          {[
            t("property.loanTerms", {
              principal: format(loan.principal),
              rate: formatRate(loan.annual_rate, locale),
              years: length,
            }),
            share < 1
              ? t("property.yourShareOfLoan", {
                  share: formatPercentLabel(share * 100, locale),
                })
              : null,
          ]
            .filter(Boolean)
            .join(" · ")}
        </PrivateAmount>
      </View>

      <LoanTrack progress={loanProgress(loan, today)} inFine={loan.kind === "in_fine"} />

      <View className="flex-row flex-wrap gap-y-4">
        <Fact label={t("property.owed")}>
          <PrivateAmount className="text-sm font-medium">{format(owed)}</PrivateAmount>
          {terms.known ? (
            <Text variant="muted" className="text-xs">
              {t("property.knownLine", {
                amount: format(terms.known.outstanding),
                date: monthAndYear(terms.known.on, locale),
              })}
            </Text>
          ) : null}
        </Fact>
        <Fact
          label={
            next
              ? t("property.nextPayment", { date: formatShortDate(next.on, locale) })
              : t("property.loanRepaid")
          }
        >
          {split ? (
            <>
              <PrivateAmount className="mb-1.5 text-sm font-medium">
                {format(split.total)}
              </PrivateAmount>
              <PaymentBar split={split} />
            </>
          ) : null}
        </Fact>
        {totals.endsOn ? (
          <Fact label={t("property.loanEnds", { date: monthAndYear(totals.endsOn, locale) })}>
            <PrivateAmount className="text-xs text-muted-foreground">
              {t("property.loanCost", { cost: format(totals.cost) })}
            </PrivateAmount>
          </Fact>
        ) : null}
      </View>

      <View className="gap-3 rounded-control border border-border p-3">
        <DebitLine
          loanId={loan.id}
          debit="payment"
          template={template}
          expected={expected?.payment ?? null}
          endsOn={totals.endsOn}
          linkedText={(amount) =>
            separate
              ? t("property.paymentLinkedSeparate", { amount })
              : t("property.paymentLinked", { amount })
          }
          notLinkedText={
            separate ? t("property.paymentNotLinkedSeparate") : t("property.paymentNotLinked")
          }
          candidates={looseTemplates}
        />
        {separate ? (
          <DebitLine
            loanId={loan.id}
            debit="insurance"
            template={insuranceTemplate}
            expected={expected?.insurance ?? null}
            endsOn={totals.endsOn}
            linkedText={(amount) => t("property.insuranceLinked", { amount })}
            notLinkedText={t("property.insuranceNotLinked")}
            candidates={looseTemplates}
          />
        ) : null}
        {missing ? (
          <ActionButton
            label={t("property.paymentAdd")}
            done={t("property.paymentAdded")}
            run={() =>
              addLoanPayment(loan.id, {
                categoryName: loanPaymentCategoryName(locale),
                description: `${loan.label} · ${propertyName}`,
                insuranceLabel: t("property.insuranceWord"),
              })
            }
          />
        ) : null}
        {mismatch ? (
          <ActionButton
            label={t("property.paymentSync")}
            done={t("property.paymentSynced")}
            run={() => syncLoanPayment(loan.id)}
          />
        ) : null}
      </View>

      <Button label={t("property.editLoan")} variant="outline" size="sm" onPress={onEdit} />
      <KnownOutstandingEditor loan={loan} today={today} />

      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: showSchedule }}
        onPress={() => setShowSchedule((open) => !open)}
        className="min-h-11 flex-row items-center justify-between"
      >
        <Text className="text-sm font-medium">{t("property.schedule")}</Text>
        <Text variant="muted">{showSchedule ? "−" : "+"}</Text>
      </Pressable>
      {showSchedule ? <ScheduleByYear schedule={schedule} /> : null}

      <Button
        label={t("property.removeLoan")}
        variant="ghost"
        size="sm"
        onPress={() => setRemoving(true)}
      />
      <ConfirmSheet
        open={removing}
        title={t("property.removeLoan")}
        message={t("property.removeLoanConfirm")}
        confirmLabel={t("property.removeLoan")}
        pending={removePending}
        onConfirm={() => void confirmRemove()}
        onCancel={() => setRemoving(false)}
      />
    </Card>
  );
}

/** The schedule by year: a bank's table is 240 rows, too many for a phone. */
function ScheduleByYear({ schedule }: { schedule: readonly LoanPayment[] }) {
  const t = useT();
  const format = useFormatCurrency();
  const years = new Map<string, { paid: number; interest: number; outstanding: number }>();
  for (const row of schedule) {
    const year = row.on.slice(0, 4);
    const sum = years.get(year) ?? { paid: 0, interest: 0, outstanding: 0 };
    sum.paid += row.payment + row.insurance;
    sum.interest += row.interest;
    sum.outstanding = row.outstanding;
    years.set(year, sum);
  }
  return (
    <View className="gap-1">
      <Text variant="muted" className="text-xs">
        {t("property.scheduleNote")}
      </Text>
      <View className="flex-row border-b border-border py-1.5">
        <Text variant="muted" className="w-14 text-xs">
          {t("property.scheduleYear")}
        </Text>
        <Text variant="muted" className="flex-1 text-right text-xs">
          {t("property.schedulePaid")}
        </Text>
        <Text variant="muted" className="flex-1 text-right text-xs">
          {t("property.scheduleInterest")}
        </Text>
        <Text variant="muted" className="flex-1 text-right text-xs">
          {t("property.scheduleOutstanding")}
        </Text>
      </View>
      {[...years].map(([year, sum]) => (
        <View key={year} className="flex-row border-b border-border py-1.5">
          <Text className="w-14 text-xs font-medium">{year}</Text>
          <PrivateAmount className="flex-1 text-right text-xs">
            {format(cents(sum.paid))}
          </PrivateAmount>
          <PrivateAmount className="flex-1 text-right text-xs">
            {format(cents(sum.interest))}
          </PrivateAmount>
          <PrivateAmount className="flex-1 text-right text-xs">
            {format(sum.outstanding)}
          </PrivateAmount>
        </View>
      ))}
    </View>
  );
}

/** « Mettre à jour le capital restant dû », and the way back from it. */
/**
 * A property's moment — half a loan repaid, its last payment, half the home
 * the user's — in gold, popping in with the success haptic the first time
 * this phone sees it.
 */
function MomentPill({ seenKey, label }: { seenKey: string; label: string }) {
  const reduce = useReducedMotion();
  const seen = useMomentSeen(seenKey);
  if (seen === null) {
    return null;
  }
  return (
    // The animated view only arrives; the pill inside it is a plain view, so
    // its gold is drawn like any other fill.
    <Animated.View
      entering={seen || reduce ? undefined : ZoomIn.springify().damping(11).stiffness(160)}
    >
      <View className="rounded-full bg-primary px-2.5 py-1">
        <Text className="text-xs font-semibold text-primary-foreground">{label}</Text>
      </View>
    </Animated.View>
  );
}

/**
 * Whether a debit's entry has fallen behind its schedule: its amount off by
 * a euro or more — a cent or two is insurance on what is owed moving month
 * by month — or its end not the loan's.
 */
function debitDrifts(
  template: AttachedTemplate | undefined,
  expected: number | null,
  endsOn: string | null,
): boolean {
  return (
    template !== undefined &&
    ((expected !== null && Math.abs(template.amount - expected) >= 1) ||
      (endsOn !== null && template.endsOn !== endsOn))
  );
}

/**
 * One of a loan's debits and its recurring entry: linked, opening it, with
 * any way it and the schedule disagree; or not yet, with the user's entries
 * that look like it to link — « C'est celle-ci ? ».
 */
function DebitLine({
  loanId,
  debit,
  template,
  expected,
  endsOn,
  linkedText,
  notLinkedText,
  candidates,
}: {
  loanId: string;
  debit: "payment" | "insurance";
  template: AttachedTemplate | undefined;
  expected: number | null;
  endsOn: string | null;
  linkedText: (amount: string) => string;
  notLinkedText: string;
  candidates: readonly AttachedTemplate[];
}) {
  const t = useT();
  const locale = useLocale();
  const format = useFormatCurrency();
  const router = useRouter();
  const colors = useThemeColors();

  if (!template) {
    const like = expected !== null ? templatesLike(candidates, expected) : [];
    return (
      <View className="gap-2">
        <Text variant="muted">{notLinkedText}</Text>
        {like.slice(0, 2).map((candidate) => (
          <View key={candidate.id} className="gap-2">
            <PrivateAmount className="text-sm">
              {t("property.candidate", {
                name: candidate.description || candidate.categoryName,
                amount: format(candidate.amount),
                day: candidate.dayOfMonth ?? 1,
              })}
            </PrivateAmount>
            <ActionButton
              label={t("property.candidateLink")}
              done={t("property.entryLinked")}
              run={() => linkLoanTemplate(loanId, candidate.id, debit)}
            />
          </View>
        ))}
      </View>
    );
  }

  const amountOff = expected !== null && Math.abs(template.amount - expected) >= 1;
  const endOff = endsOn !== null && template.endsOn !== endsOn;
  return (
    <View className="gap-1">
      <Pressable
        accessibilityRole="link"
        onPress={() => router.push(`/recurring?edit=${template.id}`)}
        className="min-h-11 flex-row items-center gap-1 self-start"
      >
        <PrivateAmount className="text-sm">{linkedText(format(template.amount))}</PrivateAmount>
        <Ionicons name="chevron-forward" size={ICON.xs} color={colors.mutedForeground} />
      </Pressable>
      {amountOff && expected !== null ? (
        <PrivateAmount className="text-xs text-warning">
          {t(debit === "payment" ? "property.paymentMismatch" : "property.insuranceMismatch", {
            template: format(template.amount),
            schedule: format(expected),
          })}
        </PrivateAmount>
      ) : null}
      {endOff && endsOn ? (
        <Text className="text-xs text-warning">
          {template.endsOn
            ? t("property.paymentEndMismatch", {
                template: monthAndYear(template.endsOn, locale),
                schedule: monthAndYear(endsOn, locale),
              })
            : t("property.paymentNoEnd", { schedule: monthAndYear(endsOn, locale) })}
        </Text>
      ) : null}
    </View>
  );
}

function KnownOutstandingEditor({ loan, today }: { loan: PropertyLoan; today: string }) {
  const t = useT();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [on, setOn] = useState(today);
  const [keeps, setKeeps] = useState<"payment" | "term">("payment");
  const [pending, setPending] = useState(false);
  const typed = parseTypedAmount(amount);
  const valid = typed !== null && typed >= 0 && /^\d{4}-\d{2}-\d{2}$/.test(on);

  if (!open) {
    return (
      <View className="gap-2">
        <Button
          label={t("property.knownUpdate")}
          variant="outline"
          size="sm"
          onPress={() => setOpen(true)}
        />
        {loan.known_outstanding !== null ? (
          <ActionButton
            label={t("property.knownClear")}
            done={t("property.saved")}
            run={() => setKnownOutstanding(loan.id, null)}
          />
        ) : null}
      </View>
    );
  }

  async function save() {
    if (!valid || typed === null) {
      return;
    }
    setPending(true);
    const result = await setKnownOutstanding(loan.id, { outstanding: typed, on, keeps });
    setPending(false);
    if (!result.success) {
      void hapticWarning();
      toast(resolveMessage(t, result.error), "error");
      return;
    }
    void hapticSuccess();
    toast(t("property.saved"));
    setOpen(false);
  }

  return (
    <View className="gap-3 rounded-control border border-border p-3">
      <TextField
        label={t("property.knownAmount")}
        value={amount}
        onChange={setAmount}
        numeric
      />
      <Field label={t("property.knownOn")}>
        <DateField value={on} onChange={setOn} accessibilityLabel={t("property.knownOn")} />
      </Field>
      <Field label={t("property.knownKeeps")}>
        <ChipRow
          label={t("property.knownKeeps")}
          value={keeps}
          onChange={setKeeps}
          options={[
            { value: "payment", label: t("property.knownKeepsPayment") },
            { value: "term", label: t("property.knownKeepsTerm") },
          ]}
        />
      </Field>
      <View className="flex-row gap-2">
        <View className="flex-1">
          <Button
            label={pending ? t("common.working") : t("property.saveValue")}
            size="sm"
            disabled={!valid || pending}
            onPress={() => void save()}
          />
        </View>
        <View className="flex-1">
          <Button
            label={t("common.cancel")}
            variant="ghost"
            size="sm"
            onPress={() => setOpen(false)}
          />
        </View>
      </View>
    </View>
  );
}

/** « Donner votre estimation »: one amount, or back to the purchase price. */
function OwnValueEditor({
  label,
  hasOwn,
  save,
}: {
  label: string;
  hasOwn: boolean;
  save: (value: number | null) => Promise<Result>;
}) {
  const t = useT();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [pending, setPending] = useState(false);
  const typed = parseTypedAmount(value);
  const valid = typed !== null && typed > 0;

  if (!open) {
    return (
      <View className="gap-2">
        <Button label={label} variant="outline" size="sm" onPress={() => setOpen(true)} />
        {hasOwn ? (
          <ActionButton
            label={t("property.ownValueClear")}
            done={t("property.saved")}
            run={() => save(null)}
          />
        ) : null}
      </View>
    );
  }

  async function submit() {
    if (!valid || typed === null) {
      return;
    }
    setPending(true);
    const result = await save(typed);
    setPending(false);
    if (!result.success) {
      void hapticWarning();
      toast(resolveMessage(t, result.error ?? "errors.couldNotSave"), "error");
      return;
    }
    void hapticSuccess();
    toast(t("property.saved"));
    setOpen(false);
  }

  return (
    <View className="gap-3">
      <TextField
        label={label}
        hint={t("property.ownValueHint")}
        value={value}
        onChange={setValue}
        numeric
        suffix="€"
      />
      <View className="flex-row gap-2">
        <View className="flex-1">
          <Button
            label={pending ? t("common.working") : t("property.saveValue")}
            size="sm"
            disabled={!valid || pending}
            onPress={() => void submit()}
          />
        </View>
        <View className="flex-1">
          <Button
            label={t("common.cancel")}
            variant="ghost"
            size="sm"
            onPress={() => setOpen(false)}
          />
        </View>
      </View>
    </View>
  );
}

/** An entry attached to the property, opening it in Récurrents. */
function TemplateRow({ template, first }: { template: AttachedTemplate; first: boolean }) {
  const locale = useLocale();
  const format = useFormatCurrency();
  const router = useRouter();
  const colors = useThemeColors();
  return (
    <Pressable
      accessibilityRole="link"
      onPress={() => router.push(`/recurring?edit=${template.id}`)}
      className={
        first
          ? "flex-row items-center gap-3 px-4 py-3 active:bg-muted/30"
          : "flex-row items-center gap-3 border-t border-border px-4 py-3 active:bg-muted/30"
      }
    >
      <View className="min-w-0 flex-1">
        <Text numberOfLines={1} className="text-sm">
          {template.description || template.categoryName}
        </Text>
        <Text variant="muted" numberOfLines={1} className="text-xs">
          {formatRecurrenceSchedule(
            {
              recurrence: template.recurrence,
              day_of_month: template.dayOfMonth,
              day_of_week: template.dayOfWeek,
              month_of_year: template.monthOfYear,
              starts_on: template.startsOn,
              ends_on: template.endsOn,
            },
            locale,
          )}
        </Text>
      </View>
      <PrivateAmount className="text-sm">{format(template.amount)}</PrivateAmount>
      <Ionicons name="chevron-forward" size={ICON.xs} color={colors.mutedForeground} />
    </Pressable>
  );
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View className="w-1/2 min-w-0 gap-0.5 pr-3">
      <Text variant="muted" className="text-xs">
        {label}
      </Text>
      {children}
    </View>
  );
}

/** A press that runs one write and says how it went. */
function ActionButton({
  label,
  done,
  run,
}: {
  label: string;
  done: string;
  run: () => Promise<Result>;
}) {
  const t = useT();
  const { toast } = useToast();
  const [pending, setPending] = useState(false);
  return (
    <Button
      label={pending ? t("common.working") : label}
      variant="outline"
      size="sm"
      disabled={pending}
      onPress={() => {
        setPending(true);
        void run().then((result) => {
          setPending(false);
          if (!result.success) {
            void hapticWarning();
            toast(resolveMessage(t, result.error ?? "errors.couldNotSave"), "error");
            return;
          }
          void hapticSuccess();
          toast(done);
        });
      }}
    />
  );
}

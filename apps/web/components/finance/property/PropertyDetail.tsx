"use client";

import { useId, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  CaretRight,
  PencilSimple,
  Plus,
} from "@phosphor-icons/react";
import { parseTypedAmount } from "@finance/core/amount-input";
import { formatPercentLabel, formatShortDate } from "@finance/core/constants";
import {
  cents,
  loanSchedule,
  loanTotals,
  nextPayment,
  outstandingOn,
  type LoanPayment,
} from "@finance/core/loan-schedule";
import {
  loanTermsFromRow,
  paymentShare,
  propertyPosition,
  valueSourceLine,
} from "@finance/core/property";
import { formatRecurrenceSchedule } from "@finance/core/recurrence";
import { loanMoment, type LoanMoment } from "@finance/core/property-moments";
import { isLet } from "@finance/core/rental";
import { formatRate } from "@finance/core/savings-accounts";
import type { PropertyLoan } from "@finance/core/types/database";
import type { AttachedTemplate, PropertyRead } from "@finance/data/properties";
import { RemoveAccount } from "@/components/finance/accounts/RemoveAccount";
import { AnimatedAmount } from "@/components/finance/AnimatedAmount";
import { useToast } from "@/components/layout/ToastProvider";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { ChoiceChips } from "@/components/ui/Picker";
import {
  addPaymentForLoan,
  removeLoan,
  removeProperty,
  setOwnValue,
  syncPayment,
  updateKnownOutstanding,
} from "@/lib/actions/property";
import { ICON } from "@/lib/icon-scale";
import { useLocale, useT } from "@/lib/locale-context";
import { useFormatCurrency } from "@/lib/use-currency";
import { EditPropertySheet } from "./EditPropertySheet";
import moments from "@/components/motion/moments.module.css";
import { useMomentSeen } from "@/components/motion/use-moment-seen";
import { cn } from "@/lib/utils";
import { AmountEditor, Fact } from "./property-controls";
import { RentalSection } from "./RentalSection";
import { useReadingWait } from "./use-reading-wait";
import { LoanSheet } from "./LoanSheet";
import {
  monthAndYear,
  PROPERTY_KIND_KEYS,
  PROPERTY_USAGE_KEYS,
} from "./property-labels";

/**
 * One property: what it is worth to the user and on whose word, each loan
 * behind it with its next payment and its schedule, and the recurring
 * entries attached to it — and the few things about it that are the user's
 * to change.
 */
export function PropertyDetail({
  detail,
  today,
  readingPending = false,
}: {
  detail: PropertyRead;
  today: string;
  /** Just added, its market still being read after the response. */
  readingPending?: boolean;
}) {
  const t = useT();
  const locale = useLocale();
  const format = useFormatCurrency();
  const router = useRouter();
  const { property, loans, templates } = detail;
  const attached = templates.filter((template) => template.attached);
  const [editing, setEditing] = useState(false);
  // The loan sheet: closed, a new loan (null), or the loan being changed.
  const [loanSheet, setLoanSheet] = useState<{
    loan: PropertyLoan | null;
  } | null>(null);
  const position = propertyPosition(property, loans, today, detail.market);
  const reading = detail.market.reading;
  // Any change in what the page shows of the market ends the wait.
  const { waiting, start: waitForReading } = useReadingWait(
    JSON.stringify([reading, detail.rent]),
    readingPending,
  );
  const source = position.estimate.source;
  const partOwned = property.ownership_share < 1;

  return (
    <div className="flex flex-col gap-8">
      <Link
        href="/property"
        className="inline-flex items-center gap-1.5 self-start text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft size={ICON.sm} aria-hidden />
        {t("property.backToList")}
      </Link>

      <Card.Bezel
        className="w-full"
        innerClassName="flex w-full min-w-0 flex-col gap-6 p-5 md:p-6"
      >
        <div className="flex min-w-0 flex-col items-center gap-1 text-center">
          <h2 className="font-head text-xl">{property.name}</h2>
          <p className="text-xs text-muted-foreground">
            {[
              t(PROPERTY_KIND_KEYS[property.kind]),
              t(PROPERTY_USAGE_KEYS[property.usage]),
              property.living_area ? `${property.living_area} m²` : null,
              property.postcode,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
          <p className="mt-3 text-xs font-medium text-muted-foreground">
            {t("property.netValue")}
          </p>
          <p>
            <AnimatedAmount
              value={position.netValue}
              format={format}
              className="font-serif text-4xl font-semibold"
            />
          </p>
          {partOwned ? (
            <p className="text-xs text-muted-foreground">
              {t("property.forYourShare", {
                share: formatPercentLabel(
                  property.ownership_share * 100,
                  locale,
                ),
              })}
            </p>
          ) : null}
        </div>

        <dl className="grid min-w-0 gap-4 sm:grid-cols-2">
          <Fact label={t("property.estimatedValue")}>
            <p className="text-sm font-medium">
              <AnimatedAmount value={position.estimate.value} format={format} />
            </p>
            {position.estimate.low !== null &&
            position.estimate.high !== null ? (
              <p className="privacy-sensitive text-xs tabular-nums">
                {t("property.valueRange", {
                  low: format(position.estimate.low),
                  high: format(position.estimate.high),
                })}
              </p>
            ) : null}
            {waiting ? (
              <p
                role="status"
                className="flex items-center gap-1.5 text-xs text-muted-foreground"
              >
                <span
                  aria-hidden
                  className="size-1.5 animate-pulse rounded-full bg-primary motion-reduce:animate-none"
                />
                {t("property.readingNow")}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                {valueSourceLine(source, locale)}
              </p>
            )}
          </Fact>
          {reading ? (
            <Fact label={t("property.pricePerM2")}>
              <p className="privacy-sensitive text-sm font-medium tabular-nums">
                {t("property.pricePerM2Line", {
                  median: format(reading.medianM2),
                  low: format(reading.q1M2),
                  high: format(reading.q3M2),
                })}
              </p>
            </Fact>
          ) : null}
          {partOwned ? (
            <Fact label={t("property.yourValue")}>
              <p className="privacy-sensitive text-sm font-medium tabular-nums">
                {format(position.value)}
              </p>
            </Fact>
          ) : null}
          <Fact label={t("property.owed")}>
            <p className="privacy-sensitive text-sm font-medium tabular-nums">
              {format(position.owed)}
            </p>
          </Fact>
          <Fact label={t("property.cost")}>
            <p className="privacy-sensitive text-sm font-medium tabular-nums">
              {format(position.cost)}
            </p>
          </Fact>
          <Fact label={t("property.gain")}>
            <p className="privacy-sensitive text-sm font-medium tabular-nums">
              {format(position.unrealisedGain)}
            </p>
          </Fact>
          {loans.length > 0 ? (
            <Fact label={t("property.principalRepaid")}>
              <p className="privacy-sensitive text-sm font-medium tabular-nums">
                {format(position.principalRepaid)}
              </p>
            </Fact>
          ) : null}
        </dl>

        <div className="flex flex-col gap-2 border-t border-border pt-4">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="self-start"
            onClick={() => setEditing(true)}
          >
            <PencilSimple size={ICON.sm} aria-hidden className="mr-1.5" />
            {t("property.edit")}
          </Button>
          <AmountEditor
            label={
              source.kind === "own"
                ? t("property.ownValueChange")
                : t("property.ownValueSet")
            }
            hint={t("property.ownValueHint")}
            initial={
              property.value_pinned === null
                ? ""
                : String(property.value_pinned)
            }
            save={(value) => setOwnValue(property.id, value)}
          />
          {source.kind === "own" ? (
            <ActionButton
              label={t("property.ownValueClear")}
              run={() => setOwnValue(property.id, null)}
            />
          ) : null}
        </div>
      </Card.Bezel>

      {isLet(property.usage) ? (
        <RentalSection detail={detail} position={position} today={today} />
      ) : null}

      <section className="flex flex-col gap-4">
        <h3 className="font-head text-lg">{t("property.loansTitle")}</h3>
        {loans.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t("property.noLoans")}
          </p>
        ) : (
          loans.map((loan) => (
            <LoanCard
              key={loan.id}
              loan={loan}
              propertyName={property.name}
              template={templates.find(
                (template) => template.id === loan.recurring_template_id,
              )}
              today={today}
              onEdit={() => setLoanSheet({ loan })}
            />
          ))
        )}
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="self-start"
          onClick={() => setLoanSheet({ loan: null })}
        >
          <Plus size={ICON.sm} aria-hidden className="mr-1.5" />
          {t("property.addLoan")}
        </Button>
      </section>

      <section className="flex flex-col gap-3">
        <h3 className="font-head text-lg">{t("property.templatesTitle")}</h3>
        {attached.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t("property.templatesNone")}
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-border rounded-card border border-border bg-card">
            {attached.map((template) => (
              <TemplateRow key={template.id} template={template} />
            ))}
          </ul>
        )}
        <Link
          href="/recurring"
          className="self-start text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          {t("property.templatesManage")}
        </Link>
      </section>

      <div>
        <RemoveAccount
          label={t("property.removeProperty")}
          confirmText={t("property.removePropertyConfirm", {
            name: property.name,
          })}
          onRemove={async () => {
            const result = await removeProperty(property.id, property.name);
            if (result.success) {
              router.push("/property");
            }
            return result;
          }}
        />
      </div>

      <EditPropertySheet
        property={property}
        open={editing}
        onOpenChange={setEditing}
        onReading={waitForReading}
      />
      <LoanSheet
        key={loanSheet?.loan?.id ?? "new"}
        propertyId={property.id}
        propertyName={property.name}
        loan={loanSheet?.loan ?? null}
        open={loanSheet !== null}
        onOpenChange={(open) => {
          if (!open) {
            setLoanSheet(null);
          }
        }}
      />
    </div>
  );
}

function LoanCard({
  loan,
  propertyName,
  template,
  today,
  onEdit,
}: {
  loan: PropertyLoan;
  propertyName: string;
  template: AttachedTemplate | undefined;
  today: string;
  onEdit: () => void;
}) {
  const t = useT();
  const locale = useLocale();
  const format = useFormatCurrency();
  const terms = loanTermsFromRow(loan);
  const schedule = loanSchedule(terms);
  const share = loan.borrower_share;
  const next = nextPayment(schedule, today);
  const totals = loanTotals(schedule, loan.fees);
  const owed = cents(outstandingOn(terms, schedule, today) * share);
  const split = next ? paymentShare(next, share) : null;
  // A cent or two either way is insurance on what is owed moving month by
  // month, not a template that has fallen behind.
  const amountDrifted =
    template !== undefined &&
    split !== null &&
    Math.abs(template.amount - split.total) >= 1;
  // After an early repayment that kept the payment, the loan ends sooner
  // and the template, left alone, would go on charging it.
  const endDrifted =
    template !== undefined &&
    totals.endsOn !== null &&
    template.endsOn !== totals.endsOn;
  const mismatch = amountDrifted || endDrifted;
  const moment = loanMoment(loan, today);
  const length =
    loan.months % 12 === 0
      ? t("property.yearsCount", { count: loan.months / 12 })
      : t("units.months", { value: loan.months });

  return (
    <Card.Bezel
      className="w-full"
      innerClassName="flex w-full min-w-0 flex-col gap-5 p-5 md:p-6"
    >
      <div className="flex flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <h4 className="font-head text-base">{loan.label}</h4>
          {moment ? <LoanMomentPill loanId={loan.id} moment={moment} /> : null}
        </div>
        <p className="privacy-sensitive text-xs text-muted-foreground tabular-nums">
          {t("property.loanTerms", {
            principal: format(loan.principal),
            rate: formatRate(loan.annual_rate, locale),
            years: length,
          })}
          {share < 1
            ? ` · ${t("property.yourShareOfLoan", {
                share: formatPercentLabel(share * 100, locale),
              })}`
            : null}
        </p>
      </div>

      <dl className="grid min-w-0 gap-4 sm:grid-cols-2">
        <Fact label={t("property.owed")}>
          <p className="privacy-sensitive text-sm font-medium tabular-nums">
            {format(owed)}
          </p>
          {terms.known ? (
            <p className="text-xs text-muted-foreground">
              {t("property.knownLine", {
                amount: format(terms.known.outstanding),
                date: monthAndYear(terms.known.on, locale),
              })}
            </p>
          ) : null}
        </Fact>
        <Fact
          label={
            next
              ? t("property.nextPayment", {
                  date: formatShortDate(next.on, locale),
                })
              : t("property.loanRepaid")
          }
        >
          {split ? (
            <>
              <p className="privacy-sensitive text-sm font-medium tabular-nums">
                {format(split.total)}
              </p>
              <p className="privacy-sensitive text-xs text-muted-foreground tabular-nums">
                {t("property.paymentSplit", {
                  principal: format(split.principal),
                  interest: format(split.interest),
                  insurance: format(split.insurance),
                })}
              </p>
            </>
          ) : null}
        </Fact>
        {totals.endsOn ? (
          <Fact
            label={t("property.loanEnds", {
              date: monthAndYear(totals.endsOn, locale),
            })}
          >
            <p className="privacy-sensitive text-xs text-muted-foreground tabular-nums">
              {t("property.loanCost", { cost: format(totals.cost) })}
            </p>
          </Fact>
        ) : null}
      </dl>

      <div className="flex flex-col gap-2 rounded-control border border-border p-3">
        {template ? (
          <Link
            href={`/recurring?edit=${template.id}`}
            className="privacy-sensitive inline-flex items-center gap-1 self-start text-sm tabular-nums underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {t("property.paymentLinked", { amount: format(template.amount) })}
            <CaretRight size={ICON.xs} aria-hidden />
          </Link>
        ) : (
          <p className="text-sm text-muted-foreground">
            {t("property.paymentNotLinked")}
          </p>
        )}
        {amountDrifted && split ? (
          <p className="privacy-sensitive text-xs text-warning tabular-nums">
            {t("property.paymentMismatch", {
              template: format(template.amount),
              schedule: format(split.total),
            })}
          </p>
        ) : null}
        {endDrifted && totals.endsOn ? (
          <p className="text-xs text-warning">
            {template.endsOn
              ? t("property.paymentEndMismatch", {
                  template: monthAndYear(template.endsOn, locale),
                  schedule: monthAndYear(totals.endsOn, locale),
                })
              : t("property.paymentNoEnd", {
                  schedule: monthAndYear(totals.endsOn, locale),
                })}
          </p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          {!template ? (
            <ActionButton
              label={t("property.paymentAdd")}
              run={() =>
                addPaymentForLoan(loan.id, `${loan.label} · ${propertyName}`)
              }
            />
          ) : null}
          {mismatch ? (
            <ActionButton
              label={t("property.paymentSync")}
              run={() => syncPayment(loan.id)}
            />
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" onClick={onEdit}>
          <PencilSimple size={ICON.sm} aria-hidden className="mr-1.5" />
          {t("property.editLoan")}
        </Button>
      </div>

      <KnownOutstanding loan={loan} today={today} />

      <ScheduleTable schedule={schedule} />

      <div>
        <RemoveAccount
          label={t("property.removeLoan")}
          confirmText={t("property.removeLoanConfirm")}
          onRemove={() => removeLoan(loan.id)}
        />
      </div>
    </Card.Bezel>
  );
}

/** « Mettre à jour le capital restant dû », and the way back from it. */
/**
 * Half the loan repaid, or its last payment made, in the month after: a
 * moment, in gold, popping in the first time this browser sees it.
 */
function LoanMomentPill({
  loanId,
  moment,
}: {
  loanId: string;
  moment: LoanMoment;
}) {
  const t = useT();
  const { seen, markSeen } = useMomentSeen(`${moment.kind}:${loanId}`);
  if (seen === null) {
    return null;
  }
  return (
    <span
      className={cn(
        "rounded-full bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground",
        !seen && moments.pop,
      )}
      onAnimationEnd={seen ? undefined : markSeen}
    >
      {moment.kind === "half"
        ? t("property.momentHalf")
        : t("property.momentLast")}
    </span>
  );
}

function KnownOutstanding({
  loan,
  today,
}: {
  loan: PropertyLoan;
  today: string;
}) {
  const t = useT();
  const id = useId();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [on, setOn] = useState(today);
  const [keeps, setKeeps] = useState<"payment" | "term">("payment");
  const [pending, startTransition] = useTransition();
  const typed = parseTypedAmount(amount);
  const valid = typed !== null && typed >= 0 && /^\d{4}-\d{2}-\d{2}$/.test(on);

  if (!open) {
    return (
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setOpen(true)}
        >
          <PencilSimple size={ICON.sm} aria-hidden className="mr-1.5" />
          {t("property.knownUpdate")}
        </Button>
        {loan.known_outstanding !== null ? (
          <ActionButton
            label={t("property.knownClear")}
            run={() => updateKnownOutstanding(loan.id, null)}
          />
        ) : null}
      </div>
    );
  }

  return (
    <form
      className="flex flex-col gap-3 rounded-control border border-border p-3"
      onSubmit={(event) => {
        event.preventDefault();
        if (!valid) {
          return;
        }
        startTransition(async () => {
          const result = await updateKnownOutstanding(loan.id, {
            outstanding: typed,
            on,
            keeps,
          });
          if (result.error) {
            toast(result.error, "error");
            return;
          }
          toast(result.message ?? t("property.saved"), "success");
          setOpen(false);
        });
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <label
            htmlFor={`${id}-amount`}
            className="text-xs text-muted-foreground"
          >
            {t("property.knownAmount")}
          </label>
          <Input
            id={`${id}-amount`}
            inputMode="decimal"
            autoComplete="off"
            autoFocus
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            className="privacy-sensitive text-base tabular-nums"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor={`${id}-on`} className="text-xs text-muted-foreground">
            {t("property.knownOn")}
          </label>
          <Input
            id={`${id}-on`}
            type="date"
            value={on}
            onChange={(event) => setOn(event.target.value)}
          />
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <p id={`${id}-keeps`} className="text-xs text-muted-foreground">
          {t("property.knownKeeps")}
        </p>
        <ChoiceChips
          options={[
            { value: "payment", label: t("property.knownKeepsPayment") },
            { value: "term", label: t("property.knownKeepsTerm") },
          ]}
          value={keeps}
          onValueChange={setKeeps}
          labelledBy={`${id}-keeps`}
        />
      </div>
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={!valid || pending}>
          {t("property.saveValue")}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setOpen(false)}
        >
          {t("common.cancel")}
        </Button>
      </div>
    </form>
  );
}

/** The schedule by year, folded: a bank's table is 240 rows. */
function ScheduleTable({ schedule }: { schedule: readonly LoanPayment[] }) {
  const t = useT();
  const format = useFormatCurrency();
  const years = new Map<
    string,
    {
      paid: number;
      principal: number;
      interest: number;
      insurance: number;
      outstanding: number;
    }
  >();
  for (const row of schedule) {
    const year = row.on.slice(0, 4);
    const sum = years.get(year) ?? {
      paid: 0,
      principal: 0,
      interest: 0,
      insurance: 0,
      outstanding: 0,
    };
    sum.paid += row.payment + row.insurance;
    sum.principal += row.principal;
    sum.interest += row.interest;
    sum.insurance += row.insurance;
    sum.outstanding = row.outstanding;
    years.set(year, sum);
  }

  return (
    <details className="group">
      <summary className="cursor-pointer text-sm font-medium">
        {t("property.schedule")}
      </summary>
      <p className="mt-2 text-xs text-muted-foreground">
        {t("property.scheduleNote")}
      </p>
      <div className="mt-2 overflow-x-auto">
        <table className="privacy-sensitive w-full min-w-[32rem] text-right text-xs tabular-nums">
          <thead className="text-muted-foreground">
            <tr>
              <th scope="col" className="py-1.5 pr-2 text-left font-medium">
                {t("property.scheduleYear")}
              </th>
              <th scope="col" className="px-2 py-1.5 font-medium">
                {t("property.schedulePaid")}
              </th>
              <th scope="col" className="px-2 py-1.5 font-medium">
                {t("property.schedulePrincipal")}
              </th>
              <th scope="col" className="px-2 py-1.5 font-medium">
                {t("property.scheduleInterest")}
              </th>
              <th scope="col" className="px-2 py-1.5 font-medium">
                {t("property.scheduleInsurance")}
              </th>
              <th scope="col" className="py-1.5 pl-2 font-medium">
                {t("property.scheduleOutstanding")}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {[...years].map(([year, sum]) => (
              <tr key={year}>
                <th scope="row" className="py-1.5 pr-2 text-left font-medium">
                  {year}
                </th>
                <td className="px-2 py-1.5">{format(cents(sum.paid))}</td>
                <td className="px-2 py-1.5">{format(cents(sum.principal))}</td>
                <td className="px-2 py-1.5">{format(cents(sum.interest))}</td>
                <td className="px-2 py-1.5">{format(cents(sum.insurance))}</td>
                <td className="py-1.5 pl-2">{format(sum.outstanding)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

/** An entry attached to the property, opening it in Récurrents. */
function TemplateRow({ template }: { template: AttachedTemplate }) {
  const locale = useLocale();
  const format = useFormatCurrency();
  return (
    <li>
      <Link
        href={`/recurring?edit=${template.id}`}
        className="flex min-w-0 items-center justify-between gap-3 px-4 py-3 transition-colors duration-hover hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
      >
        <div className="min-w-0">
          <p className="truncate text-sm">
            {template.description || template.categoryName}
          </p>
          <p className="truncate text-xs text-muted-foreground">
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
          </p>
        </div>
        <span className="flex shrink-0 items-center gap-1.5">
          <span className="privacy-sensitive text-sm tabular-nums">
            {format(template.amount)}
          </span>
          <CaretRight
            size={ICON.xs}
            aria-hidden
            className="text-muted-foreground"
          />
        </span>
      </Link>
    </li>
  );
}

/** A press that runs one write and says how it went. */
function ActionButton({
  label,
  run,
}: {
  label: string;
  run: () => Promise<{ error?: string; message?: string }>;
}) {
  const t = useT();
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await run();
          if (result.error) {
            toast(result.error, "error");
            return;
          }
          toast(result.message ?? t("property.saved"), "success");
        })
      }
    >
      {label}
    </Button>
  );
}

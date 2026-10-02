"use client";

import { useId, useState, useTransition, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, PencilSimple, Plus } from "@phosphor-icons/react";
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
} from "@finance/core/property";
import { formatRecurrenceSchedule } from "@finance/core/recurrence";
import { formatRate } from "@finance/core/savings-accounts";
import type { PropertyLoan } from "@finance/core/types/database";
import type { AttachedTemplate, PropertyRead } from "@finance/data/properties";
import { RemoveAccount } from "@/components/finance/accounts/RemoveAccount";
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
}: {
  detail: PropertyRead;
  today: string;
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
  const position = propertyPosition(property, loans, today);
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
          <p className="privacy-amount font-serif text-4xl font-semibold tabular-nums">
            {format(position.netValue)}
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
            <p className="privacy-sensitive text-sm font-medium tabular-nums">
              {format(position.estimate.value)}
            </p>
            <p className="text-xs text-muted-foreground">
              {source.kind === "own"
                ? t("property.sourceOwn", {
                    date: monthAndYear(source.on, locale),
                  })
                : t("property.sourcePurchase", {
                    date: monthAndYear(source.on, locale),
                  })}
            </p>
          </Fact>
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
        <h4 className="font-head text-base">{loan.label}</h4>
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
          <p className="privacy-sensitive text-sm tabular-nums">
            {t("property.paymentLinked", { amount: format(template.amount) })}
          </p>
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

function TemplateRow({ template }: { template: AttachedTemplate }) {
  const locale = useLocale();
  const format = useFormatCurrency();
  return (
    <li className="flex min-w-0 items-center justify-between gap-3 px-4 py-3">
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
      <p className="privacy-sensitive shrink-0 text-sm tabular-nums">
        {format(template.amount)}
      </p>
    </li>
  );
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="mt-1">{children}</dd>
    </div>
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

/** A button that opens into one amount and a save. */
function AmountEditor({
  label,
  hint,
  initial,
  save,
}: {
  label: string;
  hint: string;
  initial: string;
  save: (value: number) => Promise<{ error?: string; message?: string }>;
}) {
  const t = useT();
  const id = useId();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(initial);
  const [pending, startTransition] = useTransition();
  const typed = parseTypedAmount(value);
  const valid = typed !== null && typed > 0;

  if (!open) {
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="self-start"
        onClick={() => {
          setValue(initial);
          setOpen(true);
        }}
      >
        <PencilSimple size={ICON.sm} aria-hidden className="mr-1.5" />
        {label}
      </Button>
    );
  }

  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        if (!valid) {
          return;
        }
        startTransition(async () => {
          const result = await save(typed);
          if (result.error) {
            toast(result.error, "error");
            return;
          }
          toast(result.message ?? t("property.saved"), "success");
          setOpen(false);
        });
      }}
    >
      <label htmlFor={id} className="text-xs text-muted-foreground">
        {label}
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-48">
          <Input
            id={id}
            autoFocus
            inputMode="decimal"
            autoComplete="off"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            aria-invalid={valid || value === "" ? undefined : true}
            className="privacy-sensitive pr-8 text-base tabular-nums"
          />
          <span
            aria-hidden
            className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground"
          >
            €
          </span>
        </div>
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
      <p className="text-xs text-muted-foreground">{hint}</p>
    </form>
  );
}

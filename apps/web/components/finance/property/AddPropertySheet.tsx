"use client";

import { useId, useRef, useState, useTransition, type ReactNode } from "react";
import { Plus } from "@phosphor-icons/react";
import type { AddressMatch } from "@finance/core/address-search";
import { formatPercentLabel, todayIsoLocal } from "@finance/core/constants";
import { INTL_LOCALES } from "@finance/core/i18n/locale";
import { resolveMessage, type Key } from "@finance/core/i18n/t";
import {
  loanSchedule,
  loanTotals,
  monthlyOutlay,
  cents,
} from "@finance/core/loan-schedule";
import {
  loanPaymentCategoryName,
  NOTARY_FEE_ESTIMATE,
  notaryFeesEstimate,
} from "@finance/core/property";
import type {
  DeferralKind,
  LoanKind,
  PropertyKind,
  PropertyUsage,
} from "@finance/core/types/database";
import { loanSchema, propertySchema } from "@finance/core/validations/property";
import { parseTypedAmount } from "@finance/core/amount-input";
import { useToast } from "@/components/layout/ToastProvider";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { MobileSheet } from "@/components/ui/MobileSheet";
import { ChoiceChips } from "@/components/ui/Picker";
import { Switch } from "@/components/ui/Switch";
import { addProperty } from "@/lib/actions/property";
import { useLocale, useT } from "@/lib/locale-context";
import { useFormatCurrency } from "@/lib/use-currency";
import { cn } from "@/lib/utils";
import { ICON } from "@/lib/icon-scale";
import { AddressField } from "./AddressField";
import {
  monthAndYear,
  PROPERTY_KIND_KEYS,
  PROPERTY_USAGE_KEYS,
} from "./property-labels";

type Step = 1 | 2 | 3;

const STEP_KEYS: Record<Step, Key> = {
  1: "property.stepHome",
  2: "property.stepPurchase",
  3: "property.stepLoan",
};

/** The fields each of the first two steps answers for. */
const STEP_FIELDS: Record<1 | 2, readonly string[]> = {
  1: [
    "name",
    "kind",
    "usage",
    "livingArea",
    "ownershipShare",
    "citycode",
    "postcode",
    "latitude",
    "longitude",
  ],
  2: ["purchasedOn", "purchasePrice", "notaryFees", "agencyFees", "works"],
};

/** Stands in for the property a loan will belong to, until it exists. */
const PREVIEW_PROPERTY_ID = "00000000-0000-4000-8000-000000000000";

/** The same day a month later, or the month's last day when it is shorter. */
function aMonthAfter(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  const target = new Date(Date.UTC(year!, month!, 1));
  const last = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0),
  ).getUTCDate();
  target.setUTCDate(Math.min(day!, last));
  return target.toISOString().slice(0, 10);
}

/** Whole months from years as typed, « 20 » or « 12,5 »; "" when unreadable. */
function monthsFromYears(years: string): number | "" {
  const parsed = Number(years.replace(",", ".").trim());
  return years.trim() && Number.isFinite(parsed) ? Math.round(parsed * 12) : "";
}

function errorsFrom(
  issues: readonly { path: PropertyKey[]; message: string }[],
): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of issues) {
    const field = String(issue.path[0] ?? "");
    errors[field] ??= issue.message;
  }
  return errors;
}

/**
 * Adding a property in three steps — the home, the purchase, the loan — the
 * last one optional. The loan's payment is shown as it is typed, and goes
 * into the recurring entries unless the user says not to: they already told
 * the app everything it needs to write it.
 */
export function AddPropertySheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useT();
  if (!open) {
    return null;
  }
  return (
    <MobileSheet open onOpenChange={onOpenChange} title={t("property.add")}>
      <AddPropertyForm onDone={() => onOpenChange(false)} />
    </MobileSheet>
  );
}

function AddPropertyForm({ onDone }: { onDone: () => void }) {
  const t = useT();
  const locale = useLocale();
  const format = useFormatCurrency();
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();
  const [step, setStep] = useState<Step>(1);
  const formRef = useRef<HTMLFormElement>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // The home.
  const [address, setAddress] = useState<AddressMatch | null>(null);
  const [keepAddress, setKeepAddress] = useState(false);
  const [kind, setKind] = useState<PropertyKind>("apartment");
  // Null until the user types one: until then the name follows the kind
  // and the place.
  const [nameDraft, setNameDraft] = useState<string | null>(null);
  const [area, setArea] = useState("");
  const [usage, setUsage] = useState<PropertyUsage>("main_home");
  const [share, setShare] = useState("100");

  // The purchase.
  const [purchasedOn, setPurchasedOn] = useState(todayIsoLocal());
  const [price, setPrice] = useState("");
  const [build, setBuild] =
    useState<keyof typeof NOTARY_FEE_ESTIMATE>("existing");
  // Null until typed: until then it is the estimate for the price.
  const [notaryDraft, setNotaryDraft] = useState<string | null>(null);
  const [agency, setAgency] = useState("");
  const [works, setWorks] = useState("");

  // The loan.
  const [hasLoan, setHasLoan] = useState(true);
  const [loanLabel, setLoanLabel] = useState(t("property.loanLabelDefault"));
  const [principal, setPrincipal] = useState("");
  const [rate, setRate] = useState("");
  const [years, setYears] = useState("20");
  const [firstPayment, setFirstPayment] = useState("");
  const [insurance, setInsurance] = useState("");
  const [borrowerShare, setBorrowerShare] = useState("100");
  const [moreOptions, setMoreOptions] = useState(false);
  const [loanKind, setLoanKind] = useState<LoanKind>("amortising");
  const [deferralKind, setDeferralKind] = useState<DeferralKind>("none");
  const [deferralMonths, setDeferralMonths] = useState("");
  const [fees, setFees] = useState("");
  const [addPayment, setAddPayment] = useState(true);

  const place = address
    ? (address.district ?? address.city).replace(/ Arrondissement$/, "")
    : "";
  const name =
    nameDraft ?? [t(PROPERTY_KIND_KEYS[kind]), place].filter(Boolean).join(" ");
  const typedPrice = parseTypedAmount(price);
  const notary =
    notaryDraft ??
    (typedPrice && typedPrice > 0
      ? new Intl.NumberFormat(INTL_LOCALES[locale], {
          maximumFractionDigits: 0,
        }).format(notaryFeesEstimate(typedPrice, build))
      : "");

  const property = {
    name,
    kind,
    usage,
    livingArea: area,
    ownershipShare: share,
    citycode: address?.citycode ?? null,
    postcode: address?.postcode ?? null,
    latitude: address?.latitude ?? null,
    longitude: address?.longitude ?? null,
    addressLabel: keepAddress && address ? address.label : undefined,
    purchasedOn,
    purchasePrice: price,
    notaryFees: notary,
    agencyFees: agency,
    works,
  };
  const loan = {
    label: loanLabel,
    kind: loanKind,
    principal,
    annualRate: rate,
    months: monthsFromYears(years),
    firstPaymentOn: firstPayment,
    insuranceMonthly: insurance,
    insuranceRate: "",
    deferralKind,
    deferralMonths: deferralMonths || 0,
    fees,
    borrowerShare,
  };

  const parsedLoan = loanSchema.safeParse({
    ...loan,
    propertyId: PREVIEW_PROPERTY_ID,
  });
  const preview = (() => {
    if (!parsedLoan.success) {
      return null;
    }
    const terms = { ...parsedLoan.data, known: null };
    const schedule = loanSchedule(terms);
    const outlay = monthlyOutlay(terms, schedule);
    return {
      outlay,
      share: cents(outlay * parsedLoan.data.borrowerShare),
      partial: parsedLoan.data.borrowerShare < 1,
      totals: loanTotals(schedule, parsedLoan.data.fees),
    };
  })();

  /** A new step starts at the top of the sheet, under its title. */
  function moveTo(next: Step) {
    setStep(next);
    formRef.current?.closest('[role="dialog"]')?.scrollTo({ top: 0 });
  }

  function goOn() {
    if (step === 3) {
      return;
    }
    const parsed = propertySchema.safeParse(property);
    const fields = STEP_FIELDS[step];
    const stepErrors = parsed.success
      ? {}
      : errorsFrom(
          parsed.error.issues.filter((issue) =>
            fields.includes(String(issue.path[0])),
          ),
        );
    setErrors(stepErrors);
    if (Object.keys(stepErrors).length > 0) {
      return;
    }
    if (step === 2 && !firstPayment && purchasedOn) {
      setFirstPayment(aMonthAfter(purchasedOn));
    }
    moveTo(step === 1 ? 2 : 3);
  }

  function save() {
    if (hasLoan && !parsedLoan.success) {
      setErrors(errorsFrom(parsedLoan.error.issues));
      return;
    }
    setErrors({});
    startTransition(async () => {
      const result = await addProperty({
        property,
        loan: hasLoan ? loan : null,
        addPayment: hasLoan && addPayment,
      });
      if (result.error) {
        toast(result.error, "error");
        return;
      }
      toast(result.message ?? t("property.add"), "success");
      onDone();
    });
  }

  const error = (field: string) =>
    errors[field] ? resolveMessage(t, errors[field]) : undefined;

  return (
    <form
      ref={formRef}
      className="flex flex-col gap-5"
      onSubmit={(event) => {
        event.preventDefault();
        if (step === 3) {
          save();
        } else {
          goOn();
        }
      }}
    >
      <p className="text-xs font-medium text-muted-foreground">
        {t("property.stepLabel", { step, name: t(STEP_KEYS[step]) })}
      </p>

      {step === 1 ? (
        <>
          <Field label={t("property.address")} hint={t("property.addressHint")}>
            <AddressField value={address} onChange={setAddress} />
          </Field>
          {address ? (
            <label className="flex items-center justify-between gap-3 text-sm">
              {t("property.keepAddress")}
              <Switch
                checked={keepAddress}
                onChange={setKeepAddress}
                label={t("property.keepAddress")}
              />
            </label>
          ) : null}
          <Chips
            label={t("property.kind")}
            value={kind}
            onChange={setKind}
            options={(["apartment", "house", "other"] as const).map(
              (value) => ({ value, label: t(PROPERTY_KIND_KEYS[value]) }),
            )}
          />
          <TextField
            label={t("property.name")}
            value={name}
            onChange={setNameDraft}
            placeholder={t("property.namePlaceholder")}
            error={error("name")}
          />
          <TextField
            label={t("property.area")}
            value={area}
            onChange={setArea}
            inputMode="decimal"
            placeholder={kind === "other" ? t("property.optional") : undefined}
            error={error("livingArea")}
          />
          <Chips
            label={t("property.usage")}
            value={usage}
            onChange={setUsage}
            options={(
              [
                "main_home",
                "second_home",
                "rental_bare",
                "rental_furnished",
              ] as const
            ).map((value) => ({ value, label: t(PROPERTY_USAGE_KEYS[value]) }))}
          />
          <TextField
            label={t("property.share")}
            hint={t("property.shareHint")}
            value={share}
            onChange={setShare}
            inputMode="decimal"
            error={error("ownershipShare")}
          />
        </>
      ) : null}

      {step === 2 ? (
        <>
          <TextField
            label={t("property.purchasedOn")}
            type="date"
            value={purchasedOn}
            onChange={setPurchasedOn}
            error={error("purchasedOn")}
          />
          <TextField
            label={t("property.price")}
            hint={t("property.priceHint")}
            value={price}
            onChange={setPrice}
            inputMode="decimal"
            suffix="€"
            sensitive
            error={error("purchasePrice")}
          />
          <Chips
            label={t("property.build")}
            value={build}
            onChange={setBuild}
            options={[
              { value: "existing", label: t("property.buildExisting") },
              { value: "new", label: t("property.buildNew") },
            ]}
          />
          <TextField
            label={t("property.notaryFees")}
            hint={
              notaryDraft === null
                ? t("property.notaryHint", {
                    rate: formatPercentLabel(
                      NOTARY_FEE_ESTIMATE[build] * 100,
                      locale,
                    ),
                  })
                : undefined
            }
            value={notary}
            onChange={setNotaryDraft}
            inputMode="decimal"
            suffix="€"
            sensitive
            error={error("notaryFees")}
          />
          <TextField
            label={t("property.agencyFees")}
            value={agency}
            onChange={setAgency}
            inputMode="decimal"
            suffix="€"
            placeholder={t("property.optional")}
            sensitive
            error={error("agencyFees")}
          />
          <TextField
            label={t("property.works")}
            value={works}
            onChange={setWorks}
            inputMode="decimal"
            suffix="€"
            placeholder={t("property.optional")}
            sensitive
            error={error("works")}
          />
        </>
      ) : null}

      {step === 3 ? (
        <>
          <Chips
            label={t("property.hasLoan")}
            value={hasLoan ? "yes" : "no"}
            onChange={(value) => setHasLoan(value === "yes")}
            options={[
              { value: "yes", label: t("property.withLoan") },
              { value: "no", label: t("property.noLoan") },
            ]}
          />
          {hasLoan ? (
            <>
              <TextField
                label={t("property.loanLabel")}
                value={loanLabel}
                onChange={setLoanLabel}
                error={error("label")}
              />
              <TextField
                label={t("property.principal")}
                value={principal}
                onChange={setPrincipal}
                inputMode="decimal"
                suffix="€"
                sensitive
                error={error("principal")}
              />
              <div className="grid grid-cols-2 gap-3">
                <TextField
                  label={t("property.rate")}
                  hint={t("property.rateHint")}
                  value={rate}
                  onChange={setRate}
                  inputMode="decimal"
                  error={error("annualRate")}
                />
                <TextField
                  label={t("property.years")}
                  value={years}
                  onChange={setYears}
                  inputMode="decimal"
                  error={error("months")}
                />
              </div>
              <TextField
                label={t("property.firstPayment")}
                type="date"
                value={firstPayment}
                onChange={setFirstPayment}
                error={error("firstPaymentOn")}
              />
              <div className="grid grid-cols-2 gap-3">
                <TextField
                  label={t("property.insurance")}
                  value={insurance}
                  onChange={setInsurance}
                  inputMode="decimal"
                  suffix="€"
                  placeholder="0"
                  sensitive
                  error={error("insuranceMonthly")}
                />
                <TextField
                  label={t("property.borrowerShare")}
                  value={borrowerShare}
                  onChange={setBorrowerShare}
                  inputMode="decimal"
                  error={error("borrowerShare")}
                />
              </div>

              {moreOptions ? (
                <>
                  <Chips
                    label={t("property.loanKind")}
                    value={loanKind}
                    onChange={setLoanKind}
                    options={[
                      {
                        value: "amortising",
                        label: t("property.kindAmortising"),
                      },
                      { value: "in_fine", label: t("property.kindInFine") },
                    ]}
                  />
                  {loanKind === "amortising" ? (
                    <>
                      <Chips
                        label={t("property.deferral")}
                        value={deferralKind}
                        onChange={setDeferralKind}
                        options={[
                          { value: "none", label: t("property.deferralNone") },
                          {
                            value: "partial",
                            label: t("property.deferralPartial"),
                          },
                          {
                            value: "total",
                            label: t("property.deferralTotal"),
                          },
                        ]}
                      />
                      {deferralKind !== "none" ? (
                        <TextField
                          label={t("property.deferralMonths")}
                          value={deferralMonths}
                          onChange={setDeferralMonths}
                          inputMode="numeric"
                          error={error("deferralMonths")}
                        />
                      ) : null}
                    </>
                  ) : null}
                  <TextField
                    label={t("property.fees")}
                    value={fees}
                    onChange={setFees}
                    inputMode="decimal"
                    suffix="€"
                    placeholder={t("property.optional")}
                    sensitive
                    error={error("fees")}
                  />
                </>
              ) : (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="self-start text-muted-foreground"
                  onClick={() => setMoreOptions(true)}
                >
                  <Plus size={ICON.sm} aria-hidden className="mr-1.5" />
                  {t("property.moreOptions")}
                </Button>
              )}

              {preview ? (
                <div className="flex flex-col gap-1 rounded-control border border-border p-3">
                  <p className="privacy-sensitive text-base font-medium tabular-nums">
                    {t("property.preview", { amount: format(preview.outlay) })}
                  </p>
                  {preview.partial ? (
                    <p className="privacy-sensitive text-sm tabular-nums">
                      {t("property.previewShare", {
                        amount: format(preview.share),
                      })}
                    </p>
                  ) : null}
                  {preview.totals.endsOn ? (
                    <p className="privacy-sensitive text-xs text-muted-foreground">
                      {t("property.previewEnds", {
                        date: monthAndYear(preview.totals.endsOn, locale),
                        cost: format(preview.totals.cost),
                      })}
                    </p>
                  ) : null}
                </div>
              ) : null}

              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium">
                    {t("property.addPayment")}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t("property.addPaymentHint", {
                      category: loanPaymentCategoryName(locale),
                    })}
                  </p>
                </div>
                <Switch
                  checked={addPayment}
                  onChange={setAddPayment}
                  label={t("property.addPayment")}
                />
              </div>
            </>
          ) : null}
        </>
      ) : null}

      <div className="flex justify-between gap-2 border-t border-border pt-4">
        {step > 1 ? (
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setErrors({});
              moveTo(step === 3 ? 2 : 1);
            }}
          >
            {t("property.back")}
          </Button>
        ) : (
          <span />
        )}
        <Button type="submit" disabled={pending}>
          {step === 3 ? t("property.save") : t("property.next")}
        </Button>
      </div>
    </form>
  );
}

function Field({
  label,
  hint,
  error,
  htmlFor,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  htmlFor?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-sm font-medium">
        {label}
      </label>
      {children}
      {error ? (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

function TextField({
  label,
  hint,
  error,
  value,
  onChange,
  type = "text",
  inputMode,
  placeholder,
  suffix,
  sensitive = false,
}: {
  label: string;
  hint?: string;
  error?: string;
  value: string;
  onChange: (value: string) => void;
  type?: "text" | "date";
  inputMode?: "decimal" | "numeric";
  placeholder?: string;
  suffix?: string;
  sensitive?: boolean;
}) {
  const id = useId();
  return (
    <Field label={label} hint={hint} error={error} htmlFor={id}>
      <div className="relative">
        <Input
          id={id}
          type={type}
          inputMode={inputMode}
          autoComplete="off"
          value={value}
          placeholder={placeholder}
          aria-invalid={error ? true : undefined}
          onChange={(event) => onChange(event.target.value)}
          className={cn(
            "text-base tabular-nums",
            suffix && "pr-8",
            sensitive && "privacy-sensitive",
          )}
        />
        {suffix ? (
          <span
            aria-hidden
            className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground"
          >
            {suffix}
          </span>
        ) : null}
      </div>
    </Field>
  );
}

function Chips<T extends string>({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string }[];
}) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <p id={id} className="text-sm font-medium">
        {label}
      </p>
      <ChoiceChips
        options={options}
        value={value}
        onValueChange={onChange}
        labelledBy={id}
      />
    </div>
  );
}

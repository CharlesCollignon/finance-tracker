"use client";

import { useId, useState, type ReactNode } from "react";
import { Plus } from "@phosphor-icons/react";
import type { AddressMatch } from "@finance/core/address-search";
import { parseTypedAmount } from "@finance/core/amount-input";
import { formatPercentLabel, todayIsoLocal } from "@finance/core/constants";
import { INTL_LOCALES } from "@finance/core/i18n/locale";
import {
  cents,
  loanSchedule,
  loanTotals,
  monthlyOutlay,
} from "@finance/core/loan-schedule";
import {
  loanPaymentCategoryName,
  NOTARY_FEE_ESTIMATE,
  notaryFeesEstimate,
} from "@finance/core/property";
import { isLet } from "@finance/core/rental";
import type {
  DeferralKind,
  EnergyClass,
  LoanKind,
  Property,
  PropertyKind,
  PropertyLoan,
  PropertyUsage,
} from "@finance/core/types/database";
import {
  defaultPropertyName,
  ENERGY_CLASSES,
  fieldText as toInput,
  monthsFromYears,
} from "@finance/core/property-form";
import { loanSchema } from "@finance/core/validations/property";
import type { LoanChange, PropertyChange } from "@finance/data/properties";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { ChoiceChips } from "@/components/ui/Picker";
import { Switch } from "@/components/ui/Switch";
import { ICON } from "@/lib/icon-scale";
import { useLocale, useT } from "@/lib/locale-context";
import { useFormatCurrency } from "@/lib/use-currency";
import { cn } from "@/lib/utils";
import { AddressField } from "./AddressField";
import {
  monthAndYear,
  PROPERTY_KIND_KEYS,
  PROPERTY_USAGE_KEYS,
} from "./property-labels";

/**
 * The fields a property and a loan are typed into, shared by adding a
 * property, changing one, and adding or changing a loan — so the three can
 * never ask for different things, or read the same answer two ways.
 */

/* ----------------------------------------------------------------- property */

/** Where a stored property is, as the address field shows it once picked. */
function storedAddress(property: Property): AddressMatch | null {
  if (
    !property.citycode ||
    property.latitude === null ||
    property.longitude === null
  ) {
    return null;
  }
  return {
    label: property.address_label ?? property.postcode ?? property.citycode,
    citycode: property.citycode,
    postcode: property.postcode,
    city: "",
    district: null,
    latitude: property.latitude,
    longitude: property.longitude,
    precision: "address",
  };
}

export function usePropertyDraft(initial: Property | null) {
  const t = useT();
  const locale = useLocale();
  const amount = (value: number) => (value ? toInput(value, locale) : "");

  const [address, setAddress] = useState<AddressMatch | null>(
    initial ? storedAddress(initial) : null,
  );
  const [keepAddress, setKeepAddress] = useState(
    initial?.address_label != null,
  );
  const [kind, setKind] = useState<PropertyKind>(initial?.kind ?? "apartment");
  // Null until the user types one: until then a new property's name follows
  // its kind and its place.
  const [nameDraft, setNameDraft] = useState<string | null>(
    initial?.name ?? null,
  );
  const [area, setArea] = useState(
    initial?.living_area ? toInput(initial.living_area, locale) : "",
  );
  const [usage, setUsage] = useState<PropertyUsage>(
    initial?.usage ?? "main_home",
  );
  const [rooms, setRooms] = useState(
    initial?.rooms ? String(initial.rooms) : "",
  );
  const [energyClass, setEnergyClass] = useState<EnergyClass | null>(
    initial?.energy_class ?? null,
  );
  const [share, setShare] = useState(
    toInput((initial?.ownership_share ?? 1) * 100, locale),
  );
  const [purchasedOn, setPurchasedOn] = useState(
    initial?.purchased_on ?? todayIsoLocal(),
  );
  const [price, setPrice] = useState(
    initial ? amount(initial.purchase_price) : "",
  );
  const [build, setBuild] =
    useState<keyof typeof NOTARY_FEE_ESTIMATE>("existing");
  // Null until typed: until then a new property's fees are the estimate.
  const [notaryDraft, setNotaryDraft] = useState<string | null>(
    initial ? amount(initial.notary_fees) : null,
  );
  const [agency, setAgency] = useState(
    initial ? amount(initial.agency_fees) : "",
  );
  const [works, setWorks] = useState(initial ? amount(initial.works) : "");

  const name =
    nameDraft ?? defaultPropertyName(t(PROPERTY_KIND_KEYS[kind]), address);
  const typedPrice = parseTypedAmount(price);
  const notary =
    notaryDraft ??
    (typedPrice && typedPrice > 0
      ? new Intl.NumberFormat(INTL_LOCALES[locale], {
          maximumFractionDigits: 0,
        }).format(notaryFeesEstimate(typedPrice, build))
      : "");

  const payload: PropertyChange = {
    ...(initial ? { id: initial.id } : {}),
    name,
    kind,
    usage,
    rooms,
    energyClass,
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

  return {
    address,
    setAddress,
    keepAddress,
    setKeepAddress,
    kind,
    setKind,
    name,
    setNameDraft,
    area,
    setArea,
    usage,
    setUsage,
    rooms,
    setRooms,
    energyClass,
    setEnergyClass,
    share,
    setShare,
    purchasedOn,
    setPurchasedOn,
    price,
    setPrice,
    build,
    setBuild,
    notary,
    notaryEstimated: notaryDraft === null,
    setNotaryDraft,
    agency,
    setAgency,
    works,
    setWorks,
    payload,
  };
}

type PropertyDraft = ReturnType<typeof usePropertyDraft>;
type ErrorOf = (field: string) => string | undefined;

export function HomeFields({
  draft,
  error,
}: {
  draft: PropertyDraft;
  error: ErrorOf;
}) {
  const t = useT();
  return (
    <>
      <Field label={t("property.address")} hint={t("property.addressHint")}>
        <AddressField value={draft.address} onChange={draft.setAddress} />
      </Field>
      {draft.address ? (
        <label className="flex items-center justify-between gap-3 text-sm">
          {t("property.keepAddress")}
          <Switch
            checked={draft.keepAddress}
            onChange={draft.setKeepAddress}
            label={t("property.keepAddress")}
          />
        </label>
      ) : null}
      <Chips
        label={t("property.kind")}
        value={draft.kind}
        onChange={draft.setKind}
        options={(["apartment", "house", "other"] as const).map((value) => ({
          value,
          label: t(PROPERTY_KIND_KEYS[value]),
        }))}
      />
      <TextField
        label={t("property.name")}
        value={draft.name}
        onChange={draft.setNameDraft}
        placeholder={t("property.namePlaceholder")}
        error={error("name")}
      />
      <TextField
        label={t("property.area")}
        value={draft.area}
        onChange={draft.setArea}
        inputMode="decimal"
        placeholder={
          draft.kind === "other" ? t("property.optional") : undefined
        }
        error={error("livingArea")}
      />
      <Chips
        label={t("property.usage")}
        value={draft.usage}
        onChange={draft.setUsage}
        options={(
          [
            "main_home",
            "second_home",
            "rental_bare",
            "rental_furnished",
          ] as const
        ).map((value) => ({ value, label: t(PROPERTY_USAGE_KEYS[value]) }))}
      />
      {/* What letting it asks: the rooms, to compare with apartments of its
          size, and the DPE, which says until when it may be let. */}
      {isLet(draft.usage) && draft.kind === "apartment" ? (
        <TextField
          label={t("property.rooms")}
          hint={t("property.roomsHint")}
          value={draft.rooms}
          onChange={draft.setRooms}
          inputMode="numeric"
          placeholder={t("property.optional")}
          error={error("rooms")}
        />
      ) : null}
      {isLet(draft.usage) ? (
        <Chips
          label={t("property.energyClass")}
          value={draft.energyClass ?? "unknown"}
          onChange={(value) =>
            draft.setEnergyClass(value === "unknown" ? null : value)
          }
          options={[
            ...ENERGY_CLASSES.map((value) => ({ value, label: value })),
            { value: "unknown" as const, label: t("property.energyUnknown") },
          ]}
        />
      ) : null}
      <TextField
        label={t("property.share")}
        hint={t("property.shareHint")}
        value={draft.share}
        onChange={draft.setShare}
        inputMode="decimal"
        error={error("ownershipShare")}
      />
    </>
  );
}

export function PurchaseFields({
  draft,
  error,
}: {
  draft: PropertyDraft;
  error: ErrorOf;
}) {
  const t = useT();
  const locale = useLocale();
  return (
    <>
      <TextField
        label={t("property.purchasedOn")}
        type="date"
        value={draft.purchasedOn}
        onChange={draft.setPurchasedOn}
        error={error("purchasedOn")}
      />
      <TextField
        label={t("property.price")}
        hint={t("property.priceHint")}
        value={draft.price}
        onChange={draft.setPrice}
        inputMode="decimal"
        suffix="€"
        sensitive
        error={error("purchasePrice")}
      />
      {draft.notaryEstimated ? (
        <Chips
          label={t("property.build")}
          value={draft.build}
          onChange={draft.setBuild}
          options={[
            { value: "existing", label: t("property.buildExisting") },
            { value: "new", label: t("property.buildNew") },
          ]}
        />
      ) : null}
      <TextField
        label={t("property.notaryFees")}
        hint={
          draft.notaryEstimated
            ? t("property.notaryHint", {
                rate: formatPercentLabel(
                  NOTARY_FEE_ESTIMATE[draft.build] * 100,
                  locale,
                ),
              })
            : undefined
        }
        value={draft.notary}
        onChange={draft.setNotaryDraft}
        inputMode="decimal"
        suffix="€"
        sensitive
        error={error("notaryFees")}
      />
      <TextField
        label={t("property.agencyFees")}
        value={draft.agency}
        onChange={draft.setAgency}
        inputMode="decimal"
        suffix="€"
        placeholder={t("property.optional")}
        sensitive
        error={error("agencyFees")}
      />
      <TextField
        label={t("property.works")}
        value={draft.works}
        onChange={draft.setWorks}
        inputMode="decimal"
        suffix="€"
        placeholder={t("property.optional")}
        sensitive
        error={error("works")}
      />
    </>
  );
}

/* --------------------------------------------------------------------- loan */

/** Stands in for the property a loan will belong to, until it exists. */
const PREVIEW_PROPERTY_ID = "00000000-0000-4000-8000-000000000000";

export function useLoanDraft(initial: PropertyLoan | null) {
  const t = useT();
  const locale = useLocale();
  const amount = (value: number) => (value ? toInput(value, locale) : "");

  const [label, setLabel] = useState(
    initial?.label ?? t("property.loanLabelDefault"),
  );
  const [principal, setPrincipal] = useState(
    initial ? amount(initial.principal) : "",
  );
  const [rate, setRate] = useState(
    initial ? toInput(initial.annual_rate * 100, locale, 3) : "",
  );
  const [years, setYears] = useState(
    initial ? toInput(initial.months / 12, locale, 2) : "20",
  );
  const [firstPayment, setFirstPayment] = useState(
    initial?.first_payment_on ?? "",
  );
  const [insurance, setInsurance] = useState(
    initial ? amount(initial.insurance_monthly) : "",
  );
  const [borrowerShare, setBorrowerShare] = useState(
    toInput((initial?.borrower_share ?? 1) * 100, locale),
  );
  const [kind, setKind] = useState<LoanKind>(initial?.kind ?? "amortising");
  const [deferralKind, setDeferralKind] = useState<DeferralKind>(
    initial?.deferral_kind ?? "none",
  );
  const [deferralMonths, setDeferralMonths] = useState(
    initial?.deferral_months ? String(initial.deferral_months) : "",
  );
  const [fees, setFees] = useState(initial ? amount(initial.fees) : "");
  const [moreOptions, setMoreOptions] = useState(
    initial !== null &&
      (initial.kind !== "amortising" ||
        initial.deferral_kind !== "none" ||
        initial.fees > 0),
  );
  const [addPayment, setAddPayment] = useState(true);

  const fields: Omit<LoanChange, "propertyId"> = {
    ...(initial ? { id: initial.id } : {}),
    label,
    kind,
    principal,
    annualRate: rate,
    months: monthsFromYears(years),
    firstPaymentOn: firstPayment,
    insuranceMonthly: insurance,
    // Not offered here: an insurance rate set some other way is kept.
    insuranceRate:
      initial?.insurance_rate != null
        ? toInput(initial.insurance_rate * 100, locale, 4)
        : "",
    deferralKind,
    deferralMonths: deferralMonths || 0,
    fees,
    borrowerShare,
  };
  const payload = (propertyId: string): LoanChange => ({
    ...fields,
    propertyId,
  });
  const parsed = loanSchema.safeParse(payload(PREVIEW_PROPERTY_ID));

  return {
    label,
    setLabel,
    principal,
    setPrincipal,
    rate,
    setRate,
    years,
    setYears,
    firstPayment,
    setFirstPayment,
    insurance,
    setInsurance,
    borrowerShare,
    setBorrowerShare,
    kind,
    setKind,
    deferralKind,
    setDeferralKind,
    deferralMonths,
    setDeferralMonths,
    fees,
    setFees,
    moreOptions,
    setMoreOptions,
    addPayment,
    setAddPayment,
    fields,
    payload,
    parsed,
  };
}

type LoanDraft = ReturnType<typeof useLoanDraft>;

export function LoanFields({
  draft,
  error,
  offerPayment,
}: {
  draft: LoanDraft;
  error: ErrorOf;
  /** Whether to offer writing the payment to the recurring entries. */
  offerPayment: boolean;
}) {
  const t = useT();
  const locale = useLocale();
  const format = useFormatCurrency();
  const preview = (() => {
    if (!draft.parsed.success) {
      return null;
    }
    const terms = { ...draft.parsed.data, known: null };
    const schedule = loanSchedule(terms);
    const outlay = monthlyOutlay(terms, schedule);
    return {
      outlay,
      share: cents(outlay * draft.parsed.data.borrowerShare),
      partial: draft.parsed.data.borrowerShare < 1,
      totals: loanTotals(schedule, draft.parsed.data.fees),
    };
  })();

  return (
    <>
      <TextField
        label={t("property.loanLabel")}
        value={draft.label}
        onChange={draft.setLabel}
        error={error("label")}
      />
      <TextField
        label={t("property.principal")}
        value={draft.principal}
        onChange={draft.setPrincipal}
        inputMode="decimal"
        suffix="€"
        sensitive
        error={error("principal")}
      />
      <div className="grid grid-cols-2 gap-3">
        <TextField
          label={t("property.rate")}
          hint={t("property.rateHint")}
          value={draft.rate}
          onChange={draft.setRate}
          inputMode="decimal"
          error={error("annualRate")}
        />
        <TextField
          label={t("property.years")}
          value={draft.years}
          onChange={draft.setYears}
          inputMode="decimal"
          error={error("months")}
        />
      </div>
      <TextField
        label={t("property.firstPayment")}
        type="date"
        value={draft.firstPayment}
        onChange={draft.setFirstPayment}
        error={error("firstPaymentOn")}
      />
      <div className="grid grid-cols-2 gap-3">
        <TextField
          label={t("property.insurance")}
          value={draft.insurance}
          onChange={draft.setInsurance}
          inputMode="decimal"
          suffix="€"
          placeholder="0"
          sensitive
          error={error("insuranceMonthly") ?? error("insuranceRate")}
        />
        <TextField
          label={t("property.borrowerShare")}
          value={draft.borrowerShare}
          onChange={draft.setBorrowerShare}
          inputMode="decimal"
          error={error("borrowerShare")}
        />
      </div>

      {draft.moreOptions ? (
        <>
          <Chips
            label={t("property.loanKind")}
            value={draft.kind}
            onChange={draft.setKind}
            options={[
              { value: "amortising", label: t("property.kindAmortising") },
              { value: "in_fine", label: t("property.kindInFine") },
            ]}
          />
          {draft.kind === "amortising" ? (
            <>
              <Chips
                label={t("property.deferral")}
                value={draft.deferralKind}
                onChange={draft.setDeferralKind}
                options={[
                  { value: "none", label: t("property.deferralNone") },
                  { value: "partial", label: t("property.deferralPartial") },
                  { value: "total", label: t("property.deferralTotal") },
                ]}
              />
              {draft.deferralKind !== "none" ? (
                <TextField
                  label={t("property.deferralMonths")}
                  value={draft.deferralMonths}
                  onChange={draft.setDeferralMonths}
                  inputMode="numeric"
                  error={error("deferralMonths")}
                />
              ) : null}
            </>
          ) : null}
          <TextField
            label={t("property.fees")}
            value={draft.fees}
            onChange={draft.setFees}
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
          onClick={() => draft.setMoreOptions(true)}
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
              {t("property.previewShare", { amount: format(preview.share) })}
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

      {offerPayment ? (
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-medium">{t("property.addPayment")}</p>
            <p className="text-xs text-muted-foreground">
              {t("property.addPaymentHint", {
                category: loanPaymentCategoryName(locale),
              })}
            </p>
          </div>
          <Switch
            checked={draft.addPayment}
            onChange={draft.setAddPayment}
            label={t("property.addPayment")}
          />
        </div>
      ) : null}
    </>
  );
}

/* ------------------------------------------------------------------ pieces */

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

export function Chips<T extends string>({
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

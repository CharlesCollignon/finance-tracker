import { useEffect, useRef, useState, type ReactNode } from "react";
import { Pressable, Switch, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import {
  ADDRESS_QUERY_MIN,
  type AddressMatch,
} from "@finance/core/address-search";
import { parseTypedAmount } from "@finance/core/amount-input";
import {
  formatMonthShortYear,
  formatPercentLabel,
  todayIsoLocal,
} from "@finance/core/constants";
import { INTL_LOCALES, type Locale } from "@finance/core/i18n/locale";
import { resolveMessage, type Key } from "@finance/core/i18n/t";
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
import {
  defaultPropertyName,
  fieldText,
  monthsFromYears,
} from "@finance/core/property-form";
import type {
  DeferralKind,
  LoanKind,
  Property,
  PropertyKind,
  PropertyLoan,
  PropertyUsage,
} from "@finance/core/types/database";
import { loanSchema } from "@finance/core/validations/property";

import { ChipRow } from "@/components/ui/ChipRow";
import { DateField } from "@/components/ui/DateField";
import { Input } from "@/components/ui/Input";
import { Text } from "@/components/ui/Text";
import { findAddresses, type LoanChange, type PropertyChange } from "@/lib/properties";
import { useFormatCurrency } from "@/providers/CurrencyProvider";
import { useLocale, useT } from "@/providers/LocaleProvider";
import { ICON } from "@/theme/tokens";
import { useThemeColors } from "@/theme/useThemeColors";

/**
 * The fields a property and a loan are typed into on the phone: the web's
 * `property-fields`, drawn natively. The readings — what a typed share or
 * rate means, the default name, the notary estimate — are core's, so a
 * property added here is read exactly as one added on the web.
 */

export const PROPERTY_KIND_KEYS: Record<PropertyKind, Key> = {
  apartment: "property.kindApartment",
  house: "property.kindHouse",
  other: "property.kindOther",
};

export const PROPERTY_USAGE_KEYS: Record<PropertyUsage, Key> = {
  main_home: "property.usageMainHome",
  second_home: "property.usageSecondHome",
  rental_bare: "property.usageRentalBare",
  rental_furnished: "property.usageRentalFurnished",
};

/** « oct. 2046 »: a day without its year would read as this one. */
export function monthAndYear(isoDate: string, locale: Locale): string {
  return formatMonthShortYear(
    Number(isoDate.slice(0, 4)),
    Number(isoDate.slice(5, 7)),
    locale,
  );
}

type ErrorOf = (field: string) => string | undefined;

/* ----------------------------------------------------------------- property */

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
  const amount = (value: number) => (value ? fieldText(value, locale) : "");

  const [address, setAddress] = useState<AddressMatch | null>(
    initial ? storedAddress(initial) : null,
  );
  const [keepAddress, setKeepAddress] = useState(initial?.address_label != null);
  const [kind, setKind] = useState<PropertyKind>(initial?.kind ?? "apartment");
  const [nameDraft, setNameDraft] = useState<string | null>(initial?.name ?? null);
  const [area, setArea] = useState(
    initial?.living_area ? fieldText(initial.living_area, locale) : "",
  );
  const [usage, setUsage] = useState<PropertyUsage>(initial?.usage ?? "main_home");
  const [share, setShare] = useState(
    fieldText((initial?.ownership_share ?? 1) * 100, locale),
  );
  const [purchasedOn, setPurchasedOn] = useState(
    initial?.purchased_on ?? todayIsoLocal(),
  );
  const [price, setPrice] = useState(initial ? amount(initial.purchase_price) : "");
  const [build, setBuild] = useState<keyof typeof NOTARY_FEE_ESTIMATE>("existing");
  const [notaryDraft, setNotaryDraft] = useState<string | null>(
    initial ? amount(initial.notary_fees) : null,
  );
  const [agency, setAgency] = useState(initial ? amount(initial.agency_fees) : "");
  const [works, setWorks] = useState(initial ? amount(initial.works) : "");

  const name = nameDraft ?? defaultPropertyName(t(PROPERTY_KIND_KEYS[kind]), address);
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
        <AddressSearch value={draft.address} onChange={draft.setAddress} />
      </Field>
      {draft.address ? (
        <ToggleRow
          label={t("property.keepAddress")}
          value={draft.keepAddress}
          onChange={draft.setKeepAddress}
        />
      ) : null}
      <Field label={t("property.kind")}>
        <ChipRow
          label={t("property.kind")}
          value={draft.kind}
          onChange={draft.setKind}
          options={(["apartment", "house", "other"] as const).map((value) => ({
            value,
            label: t(PROPERTY_KIND_KEYS[value]),
          }))}
        />
      </Field>
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
        numeric
        placeholder={draft.kind === "other" ? t("property.optional") : undefined}
        error={error("livingArea")}
      />
      <Field label={t("property.usage")}>
        <ChipRow
          label={t("property.usage")}
          value={draft.usage}
          onChange={draft.setUsage}
          options={(
            ["main_home", "second_home", "rental_bare", "rental_furnished"] as const
          ).map((value) => ({ value, label: t(PROPERTY_USAGE_KEYS[value]) }))}
        />
      </Field>
      <TextField
        label={t("property.share")}
        hint={t("property.shareHint")}
        value={draft.share}
        onChange={draft.setShare}
        numeric
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
      <Field label={t("property.purchasedOn")} error={error("purchasedOn")}>
        <DateField
          value={draft.purchasedOn}
          onChange={draft.setPurchasedOn}
          accessibilityLabel={t("property.purchasedOn")}
        />
      </Field>
      <TextField
        label={t("property.price")}
        hint={t("property.priceHint")}
        value={draft.price}
        onChange={draft.setPrice}
        numeric
        suffix="€"
        error={error("purchasePrice")}
      />
      {draft.notaryEstimated ? (
        <Field label={t("property.build")}>
          <ChipRow
            label={t("property.build")}
            value={draft.build}
            onChange={draft.setBuild}
            options={[
              { value: "existing", label: t("property.buildExisting") },
              { value: "new", label: t("property.buildNew") },
            ]}
          />
        </Field>
      ) : null}
      <TextField
        label={t("property.notaryFees")}
        hint={
          draft.notaryEstimated
            ? t("property.notaryHint", {
                rate: formatPercentLabel(NOTARY_FEE_ESTIMATE[draft.build] * 100, locale),
              })
            : undefined
        }
        value={draft.notary}
        onChange={draft.setNotaryDraft}
        numeric
        suffix="€"
        error={error("notaryFees")}
      />
      <TextField
        label={t("property.agencyFees")}
        value={draft.agency}
        onChange={draft.setAgency}
        numeric
        suffix="€"
        placeholder={t("property.optional")}
        error={error("agencyFees")}
      />
      <TextField
        label={t("property.works")}
        value={draft.works}
        onChange={draft.setWorks}
        numeric
        suffix="€"
        placeholder={t("property.optional")}
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
  const amount = (value: number) => (value ? fieldText(value, locale) : "");

  const [label, setLabel] = useState(initial?.label ?? t("property.loanLabelDefault"));
  const [principal, setPrincipal] = useState(initial ? amount(initial.principal) : "");
  const [rate, setRate] = useState(
    initial ? fieldText(initial.annual_rate * 100, locale, 3) : "",
  );
  const [years, setYears] = useState(
    initial ? fieldText(initial.months / 12, locale, 2) : "20",
  );
  const [firstPayment, setFirstPayment] = useState(initial?.first_payment_on ?? "");
  const [insurance, setInsurance] = useState(
    initial ? amount(initial.insurance_monthly) : "",
  );
  const [borrowerShare, setBorrowerShare] = useState(
    fieldText((initial?.borrower_share ?? 1) * 100, locale),
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
        ? fieldText(initial.insurance_rate * 100, locale, 4)
        : "",
    deferralKind,
    deferralMonths: deferralMonths || 0,
    fees,
    borrowerShare,
  };
  const payload = (propertyId: string): LoanChange => ({ ...fields, propertyId });
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
  offerPayment: boolean;
}) {
  const t = useT();
  const locale = useLocale();
  const format = useFormatCurrency();
  const colors = useThemeColors();
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
        numeric
        suffix="€"
        error={error("principal")}
      />
      <View className="flex-row gap-3">
        <View className="min-w-0 flex-1">
          <TextField
            label={t("property.rate")}
            hint={t("property.rateHint")}
            value={draft.rate}
            onChange={draft.setRate}
            numeric
            error={error("annualRate")}
          />
        </View>
        <View className="min-w-0 flex-1">
          <TextField
            label={t("property.years")}
            value={draft.years}
            onChange={draft.setYears}
            numeric
            error={error("months")}
          />
        </View>
      </View>
      <Field label={t("property.firstPayment")} error={error("firstPaymentOn")}>
        <DateField
          value={draft.firstPayment}
          onChange={draft.setFirstPayment}
          accessibilityLabel={t("property.firstPayment")}
        />
      </Field>
      <View className="flex-row gap-3">
        <View className="min-w-0 flex-1">
          <TextField
            label={t("property.insurance")}
            value={draft.insurance}
            onChange={draft.setInsurance}
            numeric
            suffix="€"
            placeholder="0"
            error={error("insuranceMonthly") ?? error("insuranceRate")}
          />
        </View>
        <View className="min-w-0 flex-1">
          <TextField
            label={t("property.borrowerShare")}
            value={draft.borrowerShare}
            onChange={draft.setBorrowerShare}
            numeric
            error={error("borrowerShare")}
          />
        </View>
      </View>

      {draft.moreOptions ? (
        <>
          <Field label={t("property.loanKind")}>
            <ChipRow
              label={t("property.loanKind")}
              value={draft.kind}
              onChange={draft.setKind}
              options={[
                { value: "amortising", label: t("property.kindAmortising") },
                { value: "in_fine", label: t("property.kindInFine") },
              ]}
            />
          </Field>
          {draft.kind === "amortising" ? (
            <>
              <Field label={t("property.deferral")}>
                <ChipRow
                  label={t("property.deferral")}
                  value={draft.deferralKind}
                  onChange={draft.setDeferralKind}
                  options={[
                    { value: "none", label: t("property.deferralNone") },
                    { value: "partial", label: t("property.deferralPartial") },
                    { value: "total", label: t("property.deferralTotal") },
                  ]}
                />
              </Field>
              {draft.deferralKind !== "none" ? (
                <TextField
                  label={t("property.deferralMonths")}
                  value={draft.deferralMonths}
                  onChange={draft.setDeferralMonths}
                  numeric
                  error={error("deferralMonths")}
                />
              ) : null}
            </>
          ) : null}
          <TextField
            label={t("property.fees")}
            value={draft.fees}
            onChange={draft.setFees}
            numeric
            suffix="€"
            placeholder={t("property.optional")}
            error={error("fees")}
          />
        </>
      ) : (
        <Pressable
          accessibilityRole="button"
          onPress={() => draft.setMoreOptions(true)}
          className="min-h-11 flex-row items-center gap-1.5 self-start"
        >
          <Ionicons name="add" size={ICON.md} color={colors.mutedForeground} />
          <Text variant="muted">{t("property.moreOptions")}</Text>
        </Pressable>
      )}

      {preview ? (
        <View className="gap-1 rounded-control border border-border p-3">
          <Text className="text-base font-medium">
            {t("property.preview", { amount: format(preview.outlay) })}
          </Text>
          {preview.partial ? (
            <Text className="text-sm">
              {t("property.previewShare", { amount: format(preview.share) })}
            </Text>
          ) : null}
          {preview.totals.endsOn ? (
            <Text variant="muted" className="text-xs">
              {t("property.previewEnds", {
                date: monthAndYear(preview.totals.endsOn, locale),
                cost: format(preview.totals.cost),
              })}
            </Text>
          ) : null}
        </View>
      ) : null}

      {offerPayment ? (
        <ToggleRow
          label={t("property.addPayment")}
          hint={t("property.addPaymentHint", {
            category: loanPaymentCategoryName(locale),
          })}
          value={draft.addPayment}
          onChange={draft.setAddPayment}
        />
      ) : null}
    </>
  );
}

/* ------------------------------------------------------------------ pieces */

/** Long enough that a word being typed is not searched letter by letter. */
const PAUSE_MS = 300;

/**
 * An address typed and picked from what the geocoder finds, through the web
 * server. Once picked it is said back, with a way to look again.
 */
function AddressSearch({
  value,
  onChange,
}: {
  value: AddressMatch | null;
  onChange: (match: AddressMatch | null) => void;
}) {
  const t = useT();
  const colors = useThemeColors();
  const [query, setQuery] = useState("");
  const [answer, setAnswer] = useState<{
    query: string;
    matches: AddressMatch[];
  } | null>(null);
  const latest = useRef("");
  const trimmed = query.trim();

  useEffect(() => {
    if (trimmed.length < ADDRESS_QUERY_MIN) {
      return;
    }
    const timer = setTimeout(() => {
      latest.current = trimmed;
      void findAddresses(trimmed).then((matches) => {
        if (latest.current === trimmed) {
          setAnswer({ query: trimmed, matches });
        }
      });
    }, PAUSE_MS);
    return () => clearTimeout(timer);
  }, [trimmed]);

  if (value) {
    return (
      <View className="min-h-12 flex-row items-center gap-3 rounded-control border border-border bg-background px-3">
        <Ionicons name="location-outline" size={ICON.md} color={colors.foreground} />
        <Text numberOfLines={1} className="min-w-0 flex-1 text-sm">
          {value.label}
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            setQuery(value.label);
            onChange(null);
          }}
          className="h-11 justify-center"
        >
          <Text className="text-sm font-medium">{t("property.addressChange")}</Text>
        </Pressable>
      </View>
    );
  }

  const searchable = trimmed.length >= ADDRESS_QUERY_MIN;
  const current = searchable && answer?.query === trimmed ? answer : null;

  return (
    <View className="gap-2">
      <Input
        value={query}
        onChangeText={setQuery}
        placeholder={t("property.addressPlaceholder")}
        accessibilityLabel={t("property.address")}
        autoCorrect={false}
        autoCapitalize="none"
      />
      {searchable && !current ? (
        <Text variant="muted" className="text-xs">
          {t("property.addressSearching")}
        </Text>
      ) : null}
      {current && current.matches.length === 0 ? (
        <Text variant="muted" className="text-xs">
          {t("property.addressNone")}
        </Text>
      ) : null}
      {current && current.matches.length > 0 ? (
        <View className="overflow-hidden rounded-control border border-border">
          {current.matches.map((match, index) => (
            <Pressable
              key={`${match.citycode}-${match.label}`}
              accessibilityRole="button"
              onPress={() => onChange(match)}
              className={
                index > 0
                  ? "min-h-11 flex-row items-center gap-2 border-t border-border px-3"
                  : "min-h-11 flex-row items-center gap-2 px-3"
              }
            >
              <Ionicons
                name="location-outline"
                size={ICON.sm}
                color={colors.mutedForeground}
              />
              <Text numberOfLines={1} className="min-w-0 flex-1 text-sm">
                {match.label}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

export function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}) {
  const t = useT();
  return (
    <View className="min-w-0 gap-1.5">
      <Text className="text-sm font-medium">{label}</Text>
      {children}
      {error ? (
        <Text accessibilityRole="alert" className="text-xs text-destructive">
          {resolveMessage(t, error)}
        </Text>
      ) : hint ? (
        <Text variant="muted" className="text-xs">
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

export function TextField({
  label,
  hint,
  error,
  value,
  onChange,
  numeric = false,
  placeholder,
  suffix,
}: {
  label: string;
  hint?: string;
  error?: string;
  value: string;
  onChange: (value: string) => void;
  numeric?: boolean;
  placeholder?: string;
  suffix?: string;
}) {
  return (
    <Field label={label} hint={hint} error={error}>
      <View className="flex-row items-center">
        <Input
          value={value}
          onChangeText={onChange}
          placeholder={placeholder}
          accessibilityLabel={label}
          invalid={Boolean(error)}
          keyboardType={numeric ? "decimal-pad" : "default"}
          inputMode={numeric ? "decimal" : "text"}
          className={suffix ? "pr-9" : undefined}
          style={numeric ? { fontVariant: ["tabular-nums"] } : undefined}
        />
        {suffix ? (
          <Text variant="muted" className="absolute right-4 text-sm">
            {suffix}
          </Text>
        ) : null}
      </View>
    </Field>
  );
}

export function ToggleRow({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint?: string;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <View className="flex-row items-center justify-between gap-3">
      <View className="min-w-0 flex-1">
        <Text className="text-sm font-medium">{label}</Text>
        {hint ? (
          <Text variant="muted" className="text-xs">
            {hint}
          </Text>
        ) : null}
      </View>
      <Switch accessibilityLabel={label} value={value} onValueChange={onChange} />
    </View>
  );
}

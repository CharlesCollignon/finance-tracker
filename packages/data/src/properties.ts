import { firstIssue, type ActionResult } from "@finance/core/action-result";
import { categoryNameVariants, todayIsoLocal } from "@finance/core/constants";
import {
  cents,
  loanSchedule,
  regularPayment,
} from "@finance/core/loan-schedule";
import type { MarketReading } from "@finance/core/market-reading";
import { allRows } from "@finance/core/paging";
import {
  carryToLatest,
  priceIndexFromRows,
  quarterOf,
  seriesFor,
  type IndexKind,
  type PriceIndex,
} from "@finance/core/price-index";
import {
  loanDebits,
  loanTermsFromRow,
  type MarketContext,
} from "@finance/core/property";
import type { RentReference } from "@finance/core/rent-reference";
import type {
  CategoryType,
  Property,
  PropertyLoan,
  Recurrence,
} from "@finance/core/types/database";
import { loanSchema, propertySchema } from "@finance/core/validations/property";
import { z } from "zod";

import type { Db } from "./client";
import { dbError } from "./errors";
import { saveRecurringTemplate } from "./recurring-templates";
import { isMissingSchema } from "./schema";

/**
 * A user's properties and the loans behind them (migration 049), read and
 * written once for both apps.
 *
 * Every write takes what a form typed and validates it here with core's
 * schemas, so the web's action and the phone's mutation cannot disagree on
 * what a property is. A loan's payment is an ordinary recurring template,
 * attached to the property and linked from the loan: writing one here goes
 * through the same save as the Récurrents tab, so the month fills itself
 * from it like from any other.
 */

export type PropertyChange = z.input<typeof propertySchema>;
export type LoanChange = z.input<typeof loanSchema>;

const uuid = z.string().uuid();

/** A recurring template attached to a property, as its page lists it. */
export interface AttachedTemplate {
  id: string;
  description: string | null;
  amount: number;
  recurrence: Recurrence;
  dayOfMonth: number | null;
  dayOfWeek: number | null;
  monthOfYear: number | null;
  startsOn: string | null;
  endsOn: string | null;
  active: boolean;
  /**
   * Attached to the property, rather than only paying one of its loans:
   * what its page lists among its recurring entries.
   */
  attached: boolean;
  categoryName: string;
  categoryType: CategoryType;
}

export interface PropertyRead {
  property: Property;
  loans: PropertyLoan[];
  templates: AttachedTemplate[];
  /** Its market reading and how the index moves its price (migration 050). */
  market: MarketContext;
  /** What homes like it are advertised for around it, when let (051). */
  rent: RentReference | null;
}

export interface PropertiesState {
  /** Oldest purchase first. */
  properties: PropertyRead[];
  /**
   * The user's monthly expense templates no loan stands on yet: what a loan
   * without a template for one of its debits offers to link.
   */
  looseTemplates: AttachedTemplate[];
  /** False until migration 049 has run. */
  available: boolean;
}

function propertyFromRow(row: Property): Property {
  return {
    ...row,
    latitude: row.latitude === null ? null : Number(row.latitude),
    longitude: row.longitude === null ? null : Number(row.longitude),
    living_area: row.living_area === null ? null : Number(row.living_area),
    ownership_share: Number(row.ownership_share),
    purchase_price: Number(row.purchase_price),
    notary_fees: Number(row.notary_fees),
    agency_fees: Number(row.agency_fees),
    works: Number(row.works),
    value_pinned: row.value_pinned === null ? null : Number(row.value_pinned),
    yearly_growth:
      row.yearly_growth === null ? null : Number(row.yearly_growth),
  };
}

function loanFromRow(row: PropertyLoan): PropertyLoan {
  return {
    ...row,
    principal: Number(row.principal),
    annual_rate: Number(row.annual_rate),
    insurance_monthly: Number(row.insurance_monthly),
    insurance_rate:
      row.insurance_rate === null ? null : Number(row.insurance_rate),
    fees: Number(row.fees),
    borrower_share: Number(row.borrower_share),
    known_outstanding:
      row.known_outstanding === null ? null : Number(row.known_outstanding),
  };
}

/** The index series a property's kind is carried by. */
export function indexKindOf(kind: Property["kind"]): IndexKind {
  return kind === "other" ? "all" : kind;
}

/** The index for these series, or none before migration 050. */
export async function getPriceIndex(
  db: Db,
  series: readonly string[],
): Promise<PriceIndex> {
  if (series.length === 0) {
    return new Map();
  }
  const rows = await allRows<{
    series: string;
    quarter: string;
    value: number;
  }>((from, to) =>
    db
      .from("housing_price_index")
      .select("series, quarter, value")
      .in("series", [...series])
      .order("series")
      .order("quarter")
      .range(from, to),
  ).catch((error: { code?: string }) => {
    if (isMissingSchema(error)) {
      return [];
    }
    throw error;
  });
  return priceIndexFromRows(rows);
}

/* ------------------------------------------------------------------ reading */

interface TemplateRow {
  id: string;
  description: string | null;
  amount: number;
  recurrence: Recurrence;
  day_of_month: number | null;
  day_of_week: number | null;
  month_of_year: number | null;
  starts_on: string | null;
  ends_on: string | null;
  active: boolean;
  categories: { name: string; type: CategoryType } | null;
}

function templateFromRow(template: TemplateRow, attached: boolean): AttachedTemplate {
  return {
    id: template.id,
    description: template.description,
    amount: Number(template.amount),
    recurrence: template.recurrence,
    dayOfMonth: template.day_of_month,
    dayOfWeek: template.day_of_week,
    monthOfYear: template.month_of_year,
    startsOn: template.starts_on,
    endsOn: template.ends_on,
    active: template.active,
    attached,
    categoryName: template.categories?.name ?? "",
    categoryType: template.categories?.type ?? "expense",
  };
}

/** Every property, with its loans and the templates attached to it. */
export async function getProperties(
  db: Db,
  userId: string,
): Promise<PropertiesState> {
  const { data: rows, error } = await db
    .from("properties")
    .select("*")
    .eq("user_id", userId)
    .order("purchased_on")
    .order("created_at");
  if (error) {
    if (isMissingSchema(error)) {
      return { properties: [], looseTemplates: [], available: false };
    }
    throw error;
  }
  const properties = (rows ?? []).map(propertyFromRow);
  if (properties.length === 0) {
    return { properties: [], looseTemplates: [], available: true };
  }

  const ids = properties.map((property) => property.id);
  const { data: loanRows, error: loansError } = await db
    .from("property_loans")
    .select("*")
    .eq("user_id", userId)
    .in("property_id", ids)
    .order("created_at");
  if (loansError) {
    throw loansError;
  }
  const loans = (loanRows ?? []).map(loanFromRow);

  // The templates attached to a property, and those its loans pay through,
  // which the user may since have detached from it.
  const linked = loans.flatMap((loan) =>
    [loan.recurring_template_id, loan.insurance_template_id].filter(
      (id): id is string => id !== null,
    ),
  );
  const query = db
    .from("recurring_templates")
    .select(
      "id, property_id, description, amount, recurrence, day_of_month, day_of_week, month_of_year, starts_on, ends_on, active, categories(name, type)",
    )
    .eq("user_id", userId);
  const { data: templateRows, error: templatesError } = await (
    linked.length > 0
      ? query.or(
          `property_id.in.(${ids.join(",")}),id.in.(${linked.join(",")})`,
        )
      : query.in("property_id", ids)
  ).order("created_at");
  if (templatesError) {
    throw templatesError;
  }

  const { data: readingRows, error: readingsError } = await db
    .from("property_market_readings")
    .select("*")
    .eq("user_id", userId)
    .in("property_id", ids);
  if (readingsError && !isMissingSchema(readingsError)) {
    throw readingsError;
  }
  const { data: looseRows, error: looseError } = await db
    .from("recurring_templates")
    .select(
      "id, property_id, description, amount, recurrence, day_of_month, day_of_week, month_of_year, starts_on, ends_on, active, categories(name, type)",
    )
    .eq("user_id", userId)
    .eq("active", true)
    .eq("recurrence", "monthly")
    .order("created_at");
  if (looseError) {
    throw looseError;
  }
  const loanTemplates = new Set(linked);

  const { data: rentRows, error: rentsError } = await db
    .from("property_rent_references")
    .select("*")
    .eq("user_id", userId)
    .in("property_id", ids);
  if (rentsError && !isMissingSchema(rentsError)) {
    throw rentsError;
  }

  const candidates = new Map(
    properties.map((property) => [
      property.id,
      seriesFor(property.citycode, indexKindOf(property.kind)),
    ]),
  );
  const index = await getPriceIndex(db, [
    ...new Set([...candidates.values()].flat()),
  ]);

  return {
    available: true,
    looseTemplates: (looseRows ?? [])
      .filter(
        (template) =>
          template.categories?.type === "expense" &&
          !loanTemplates.has(template.id),
      )
      .map((template) => templateFromRow(template, false)),
    properties: properties.map((property) => {
      const own = loans.filter((loan) => loan.property_id === property.id);
      const reading = (readingRows ?? []).find(
        (row) => row.property_id === property.id,
      );
      const market: MarketContext = {
        reading: reading
          ? {
              scope: reading.scope,
              medianM2: Number(reading.median_m2),
              q1M2: Number(reading.q1_m2),
              q3M2: Number(reading.q3_m2),
              sales: reading.sales,
              periodFrom: reading.period_from,
              periodTo: reading.period_to,
              quarter: reading.quarter,
            }
          : null,
        purchaseCarry: carryToLatest(
          index,
          candidates.get(property.id) ?? [],
          quarterOf(property.purchased_on),
        ),
      };
      const paidThrough = new Set(
        own.flatMap((loan) => [
          loan.recurring_template_id,
          loan.insurance_template_id,
        ]),
      );
      const rent = (rentRows ?? []).find(
        (row) => row.property_id === property.id,
      );
      return {
        property,
        loans: own,
        market,
        rent: rent
          ? {
              series: rent.series,
              rentM2: Number(rent.rent_m2),
              lowM2: Number(rent.low_m2),
              highM2: Number(rent.high_m2),
              scope: rent.scope,
              observations: rent.observations,
              edition: rent.edition,
            }
          : null,
        templates: (templateRows ?? [])
          .filter(
            (template) =>
              template.property_id === property.id ||
              paidThrough.has(template.id),
          )
          .map((template) =>
            templateFromRow(template, template.property_id === property.id),
          ),
      };
    }),
  };
}

/**
 * Each property's name, for a picker: what a recurring template can be
 * attached to. Empty before migration 049.
 */
export async function getPropertyNames(
  db: Db,
  userId: string,
): Promise<{ id: string; name: string }[]> {
  const { data, error } = await db
    .from("properties")
    .select("id, name")
    .eq("user_id", userId)
    .order("purchased_on");
  if (error) {
    if (isMissingSchema(error)) {
      return [];
    }
    throw error;
  }
  return data ?? [];
}

/* ------------------------------------------------------------------ writing */

/** Add a property, or change one: everything but the user's own value. */
export async function saveProperty(
  db: Db,
  userId: string,
  input: PropertyChange,
): Promise<ActionResult<{ propertyId: string }>> {
  const parsed = propertySchema.safeParse(input);
  if (!parsed.success) {
    return { error: firstIssue(parsed.error) };
  }
  const data = parsed.data;
  const fields = {
    name: data.name,
    kind: data.kind,
    usage: data.usage,
    citycode: data.citycode,
    postcode: data.postcode,
    latitude: data.latitude,
    longitude: data.longitude,
    address_label: data.addressLabel,
    living_area: data.livingArea,
    ...(data.rooms === undefined ? {} : { rooms: data.rooms }),
    ...(data.energyClass === undefined
      ? {}
      : { energy_class: data.energyClass }),
    ownership_share: data.ownershipShare,
    purchased_on: data.purchasedOn,
    purchase_price: data.purchasePrice,
    notary_fees: data.notaryFees,
    agency_fees: data.agencyFees,
    works: data.works,
  };

  if (data.id) {
    const { error } = await db
      .from("properties")
      .update({ ...fields, updated_at: new Date().toISOString() })
      .eq("id", data.id)
      .eq("user_id", userId);
    return error
      ? { error: dbError(error) }
      : { success: true, propertyId: data.id };
  }

  const { data: inserted, error } = await db
    .from("properties")
    .insert({ user_id: userId, ...fields })
    .select("id")
    .single();
  if (error || !inserted) {
    return { error: error ? dbError(error) : "errors.couldNotSave" };
  }
  return { success: true, propertyId: inserted.id };
}

/**
 * The user's own figure for what a property is worth, dated today — or
 * none, which leaves the app's estimate.
 */
export async function setPropertyValue(
  db: Db,
  userId: string,
  propertyId: string,
  value: number | null,
): Promise<ActionResult> {
  if (!uuid.safeParse(propertyId).success) {
    return { error: "errors.invalidInput" };
  }
  if (value !== null && !(Number.isFinite(value) && value > 0)) {
    return { error: "errors.amountPositive" };
  }
  const { error } = await db
    .from("properties")
    .update({
      value_pinned: value === null ? null : cents(value),
      value_pinned_on: value === null ? null : todayIsoLocal(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", propertyId)
    .eq("user_id", userId);
  return error ? { error: dbError(error) } : { success: true };
}

/**
 * How much a year the user expects a property to gain, for the long view —
 * or none, back to the app's default. As a fraction, between −20 % and 20 %.
 */
export async function setPropertyGrowth(
  db: Db,
  userId: string,
  propertyId: string,
  growth: number | null,
): Promise<ActionResult> {
  if (!uuid.safeParse(propertyId).success) {
    return { error: "errors.invalidInput" };
  }
  if (growth !== null && !(Number.isFinite(growth) && Math.abs(growth) <= 0.2)) {
    return { error: "errors.growthRange" };
  }
  const { error } = await db
    .from("properties")
    .update({ yearly_growth: growth, updated_at: new Date().toISOString() })
    .eq("id", propertyId)
    .eq("user_id", userId);
  return error ? { error: dbError(error) } : { success: true };
}

/**
 * Delete a property and its loans. The templates attached to it stay, on
 * the Récurrents tab, attached to nothing: a taxe foncière still falls due
 * whatever the app knows about the home.
 */
export async function deleteProperty(
  db: Db,
  userId: string,
  propertyId: string,
): Promise<ActionResult> {
  if (!uuid.safeParse(propertyId).success) {
    return { error: "errors.invalidInput" };
  }
  const { error } = await db
    .from("properties")
    .delete()
    .eq("id", propertyId)
    .eq("user_id", userId);
  return error ? { error: dbError(error) } : { success: true };
}

/**
 * The user's category of this name and type, in either language, or a new
 * one under it. Where a loan's payment, and a property's rent, are filed.
 */
async function categoryNamed(
  db: Db,
  userId: string,
  name: string,
  type: "expense" | "income" = "expense",
  icon = "bank",
): Promise<{ id: string } | { error: string }> {
  const { data: found, error } = await db
    .from("categories")
    .select("id, name")
    .eq("user_id", userId)
    .eq("type", type)
    .in("name", categoryNameVariants(name))
    .order("created_at")
    .limit(1);
  if (error) {
    return { error: dbError(error) };
  }
  if (found && found.length > 0) {
    return { id: found[0]!.id };
  }
  const { data: created, error: createError } = await db
    .from("categories")
    .insert({ user_id: userId, name, type, icon })
    .select("id")
    .single();
  if (createError || !created) {
    return {
      error: createError ? dbError(createError) : "errors.couldNotSave",
    };
  }
  return { id: created.id };
}

/** Which of a loan's debits a template stands for. */
export type LoanDebit = "payment" | "insurance";

async function linkTemplate(
  db: Db,
  userId: string,
  loan: { id: string; property_id: string },
  templateId: string,
  debit: LoanDebit = "payment",
): Promise<ActionResult> {
  const { error: attachError } = await db
    .from("recurring_templates")
    .update({ property_id: loan.property_id })
    .eq("id", templateId)
    .eq("user_id", userId);
  if (attachError) {
    return { error: dbError(attachError) };
  }
  const { error } = await db
    .from("property_loans")
    .update({
      ...(debit === "payment"
        ? { recurring_template_id: templateId }
        : { insurance_template_id: templateId }),
      updated_at: new Date().toISOString(),
    })
    .eq("id", loan.id)
    .eq("user_id", userId);
  return error ? { error: dbError(error) } : { success: true };
}

/**
 * Link a template the user already has to one of a loan's debits — its
 * payment, or its insurance debited apart — and attach it to the property.
 * Its amount is left as the user wrote it: the property says when it and
 * the schedule disagree.
 */
export async function linkLoanTemplate(
  db: Db,
  userId: string,
  input: { loanId: string; templateId: string; debit: LoanDebit },
): Promise<ActionResult> {
  if (
    !uuid.safeParse(input.loanId).success ||
    !uuid.safeParse(input.templateId).success
  ) {
    return { error: "errors.invalidInput" };
  }
  const [{ data: loan, error }, { data: template, error: templateError }] =
    await Promise.all([
      db
        .from("property_loans")
        .select("id, property_id")
        .eq("id", input.loanId)
        .eq("user_id", userId)
        .maybeSingle(),
      db
        .from("recurring_templates")
        .select("id")
        .eq("id", input.templateId)
        .eq("user_id", userId)
        .maybeSingle(),
    ]);
  if (error || templateError) {
    return { error: dbError((error ?? templateError)!) };
  }
  if (!loan || !template) {
    return { error: "errors.notFound" };
  }
  return linkTemplate(db, userId, loan, input.templateId, input.debit);
}

export interface LoanPaymentOptions {
  /**
   * Write a monthly template for the loan's payment: the user's share of the
   * regular payment and its insurance, from the first regular payment to
   * the last, filed under this category name (found in either language, or
   * created).
   */
  addPayment?: {
    categoryName: string;
    description: string;
    /**
     * The word the insurance's own template is described by, in the
     * reader's language — « Assurance · Prêt principal · … » — when it is
     * debited apart.
     */
    insuranceLabel?: string;
  };
  /** Or link a template the user already has. */
  templateId?: string;
}

/**
 * Add a loan, or change its terms, and give it its payment.
 *
 * A template written here covers the regular payments only: the months of
 * a deferral, and the principal an in fine loan repays at the end, are not
 * in it. A template is never written for a loan that already has one, and
 * one the user picked is linked rather than copied.
 */
export async function saveLoan(
  db: Db,
  userId: string,
  input: LoanChange,
  options: LoanPaymentOptions = {},
): Promise<ActionResult<{ loanId: string; templateId: string | null }>> {
  const parsed = loanSchema.safeParse(input);
  if (!parsed.success) {
    return { error: firstIssue(parsed.error) };
  }
  const data = parsed.data;
  const fields = {
    property_id: data.propertyId,
    label: data.label,
    kind: data.kind,
    principal: data.principal,
    annual_rate: data.annualRate,
    months: data.months,
    first_payment_on: data.firstPaymentOn,
    insurance_monthly: data.insuranceMonthly,
    insurance_rate: data.insuranceRate,
    deferral_kind: data.deferralKind,
    deferral_months: data.deferralMonths,
    fees: data.fees,
    borrower_share: data.borrowerShare,
    ...(data.insuranceSeparate === undefined
      ? {}
      : {
          insurance_separate: data.insuranceSeparate,
          // Back to one debit: the insurance's template is no longer the
          // loan's. It stays among the recurring entries for the user.
          ...(data.insuranceSeparate ? {} : { insurance_template_id: null }),
        }),
  };

  const write = data.id
    ? db
        .from("property_loans")
        .update({ ...fields, updated_at: new Date().toISOString() })
        .eq("id", data.id)
        .eq("user_id", userId)
    : db.from("property_loans").insert({ user_id: userId, ...fields });
  const { data: saved, error } = await write.select("*").single();
  if (error || !saved) {
    return { error: error ? dbError(error) : "errors.couldNotSave" };
  }
  const loan = loanFromRow(saved);

  if (options.templateId) {
    const linked = await linkTemplate(db, userId, loan, options.templateId);
    return linked.error
      ? { error: linked.error }
      : { success: true, loanId: loan.id, templateId: options.templateId };
  }

  if (!options.addPayment || !missingDebits(loan)) {
    return {
      success: true,
      loanId: loan.id,
      templateId: loan.recurring_template_id,
    };
  }

  const added = await writeLoanPayment(db, userId, loan, options.addPayment);
  return added.success
    ? { success: true, loanId: loan.id, templateId: added.templateId }
    : { error: added.error };
}

/**
 * Add a property, and the loan that paid for it when there was one, with
 * its payment among the recurring entries when asked — what both apps' add
 * sheets save. A loan that cannot be saved takes the property back with it,
 * so trying again does not leave the same home twice.
 */
export async function addPropertyWithLoan(
  db: Db,
  userId: string,
  input: {
    property: PropertyChange;
    loan: Omit<LoanChange, "propertyId"> | null;
    /**
     * The category the payment is filed under, and the word for its
     * insurance debited apart, in the reader's words.
     */
    payment: { categoryName: string; insuranceLabel?: string } | null;
  },
): Promise<ActionResult<{ propertyId: string; paymentAmount: number | null }>> {
  const saved = await saveProperty(db, userId, input.property);
  if (!saved.success) {
    return { error: saved.error };
  }
  const { propertyId } = saved;
  if (!input.loan) {
    return { success: true, propertyId, paymentAmount: null };
  }

  const description = `${String(input.loan.label).trim()} · ${String(
    input.property.name,
  ).trim()}`;
  const loan = await saveLoan(
    db,
    userId,
    { ...input.loan, propertyId },
    input.payment
      ? {
          addPayment: {
            categoryName: input.payment.categoryName,
            insuranceLabel: input.payment.insuranceLabel,
            description,
          },
        }
      : {},
  );
  if (!loan.success) {
    await deleteProperty(db, userId, propertyId);
    return { error: loan.error };
  }
  if (!loan.templateId) {
    return { success: true, propertyId, paymentAmount: null };
  }
  const { data: template } = await db
    .from("recurring_templates")
    .select("amount")
    .eq("id", loan.templateId)
    .eq("user_id", userId)
    .maybeSingle();
  return {
    success: true,
    propertyId,
    paymentAmount: template ? Number(template.amount) : null,
  };
}

/** Whether a loan lacks a template for one of its debits. */
function missingDebits(loan: PropertyLoan): boolean {
  return (
    !loan.recurring_template_id ||
    (loan.insurance_separate &&
      !loan.insurance_template_id &&
      (loan.insurance_monthly > 0 || (loan.insurance_rate ?? 0) > 0))
  );
}

/**
 * Write the templates a loan lacks: its payment — with its insurance, or
 * without it when the insurance is debited apart — and that insurance's
 * own. Each from the first regular payment to the last, the user's share,
 * filed under the category name given (found in either language, or made).
 */
async function writeLoanPayment(
  db: Db,
  userId: string,
  loan: PropertyLoan,
  payment: {
    categoryName: string;
    description: string;
    insuranceLabel?: string;
  },
): Promise<ActionResult<{ templateId: string | null }>> {
  const terms = loanTermsFromRow(loan);
  const schedule = loanSchedule(terms);
  const first = regularPayment(terms, schedule);
  const last = schedule.at(-1);
  if (!first || !last) {
    return { success: true, templateId: null };
  }
  const category = await categoryNamed(db, userId, payment.categoryName);
  if ("error" in category) {
    return { error: category.error };
  }
  const debits = loanDebits(
    first,
    Number(loan.borrower_share),
    loan.insurance_separate,
  );
  const write = async (
    amount: number,
    description: string,
    debit: LoanDebit,
  ): Promise<ActionResult<{ templateId: string }>> => {
    const template = await saveRecurringTemplate(db, userId, {
      categoryId: category.id,
      description,
      pricingType: "fixed",
      amount,
      recurrence: "monthly",
      dayOfMonth: Number(first.on.slice(8, 10)),
      startsOn: first.on,
      endsOn: last.on,
      propertyId: loan.property_id,
    });
    if ("error" in template) {
      return { error: template.error };
    }
    const linked = await linkTemplate(
      db,
      userId,
      loan,
      template.templateId,
      debit,
    );
    return linked.error
      ? { error: linked.error }
      : { success: true, templateId: template.templateId };
  };

  let templateId = loan.recurring_template_id;
  if (!templateId) {
    const written = await write(debits.payment, payment.description, "payment");
    if (!written.success) {
      return { error: written.error };
    }
    templateId = written.templateId;
  }
  if (debits.insurance && !loan.insurance_template_id) {
    const written = await write(
      debits.insurance,
      payment.insuranceLabel
        ? `${payment.insuranceLabel} · ${payment.description}`
        : payment.description,
      "insurance",
    );
    if (!written.success) {
      return { error: written.error };
    }
  }
  return { success: true, templateId };
}

/**
 * Give a loan the templates it lacks among the recurring entries: what
 * `saveLoan` writes when asked, for a loan saved without them — its payment,
 * or its insurance once it is debited apart. One it already has is
 * attached to the property again, in case it was taken off.
 */
export async function addLoanPayment(
  db: Db,
  userId: string,
  loanId: string,
  payment: {
    categoryName: string;
    description: string;
    insuranceLabel?: string;
  },
): Promise<ActionResult<{ templateId: string | null }>> {
  const { data: row, error } = await db
    .from("property_loans")
    .select("*")
    .eq("id", loanId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error || !row) {
    return { error: error ? dbError(error) : "errors.notFound" };
  }
  const loan = loanFromRow(row);
  if (!missingDebits(loan) && loan.recurring_template_id) {
    const linked = await linkTemplate(
      db,
      userId,
      loan,
      loan.recurring_template_id,
    );
    return linked.success
      ? { success: true, templateId: loan.recurring_template_id }
      : { error: linked.error };
  }
  return writeLoanPayment(db, userId, loan, payment);
}

/**
 * What the bank says is still owed on a loan, and what it kept after an
 * early repayment — or none, back to the schedule as first set out.
 */
export async function setLoanKnownOutstanding(
  db: Db,
  userId: string,
  loanId: string,
  known: {
    outstanding: number;
    on: string;
    keeps: "payment" | "term";
  } | null,
): Promise<ActionResult> {
  if (!uuid.safeParse(loanId).success) {
    return { error: "errors.invalidInput" };
  }
  if (
    known !== null &&
    (!(Number.isFinite(known.outstanding) && known.outstanding >= 0) ||
      !/^\d{4}-\d{2}-\d{2}$/.test(known.on))
  ) {
    return { error: "errors.invalidInput" };
  }
  const { error } = await db
    .from("property_loans")
    .update({
      known_outstanding: known === null ? null : cents(known.outstanding),
      known_outstanding_on: known?.on ?? null,
      known_keeps: known?.keeps ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", loanId)
    .eq("user_id", userId);
  return error ? { error: dbError(error) } : { success: true };
}

/**
 * Bring a loan's templates in line with its schedule: the amount of the
 * next payment — with its insurance, or without it when that is debited
 * apart — the insurance's own, and the day of the last. Rows already
 * written keep what they say; the months ahead follow.
 */
export async function syncLoanPayment(
  db: Db,
  userId: string,
  loanId: string,
): Promise<ActionResult> {
  const { data: row, error } = await db
    .from("property_loans")
    .select("*")
    .eq("id", loanId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error || !row) {
    return { error: error ? dbError(error) : "errors.notFound" };
  }
  const loan = loanFromRow(row);
  if (!loan.recurring_template_id) {
    return { error: "errors.notFound" };
  }
  const terms = loanTermsFromRow(loan);
  const schedule = loanSchedule(terms);
  const today = todayIsoLocal();
  const next = schedule.find((payment) => payment.on >= today);
  const last = schedule.at(-1);
  if (!next || !last) {
    return { error: "errors.notFound" };
  }
  const debits = loanDebits(
    next,
    Number(loan.borrower_share),
    loan.insurance_separate,
  );
  const updates: { id: string; amount: number }[] = [
    { id: loan.recurring_template_id, amount: debits.payment },
    ...(debits.insurance !== null && loan.insurance_template_id
      ? [{ id: loan.insurance_template_id, amount: debits.insurance }]
      : []),
  ];
  for (const update of updates) {
    const { error: updateError } = await db
      .from("recurring_templates")
      .update({ amount: update.amount, ends_on: last.on })
      .eq("id", update.id)
      .eq("user_id", userId);
    if (updateError) {
      return { error: dbError(updateError) };
    }
  }
  return { success: true };
}

/** Delete a loan. Its payment template stays, as the property's does. */
export async function deleteLoan(
  db: Db,
  userId: string,
  loanId: string,
): Promise<ActionResult> {
  if (!uuid.safeParse(loanId).success) {
    return { error: "errors.invalidInput" };
  }
  const { error } = await db
    .from("property_loans")
    .delete()
    .eq("id", loanId)
    .eq("user_id", userId);
  return error ? { error: dbError(error) } : { success: true };
}

/* ------------------------------------------------------------ the market */

/**
 * Keep what the market says about a property, carried to `quarter` — or,
 * with no reading, forget an old one, so the value falls back to the
 * purchase price carried rather than to a reading the market no longer
 * bears out. The user's client under RLS, or the service role from the
 * market cron.
 */
export async function saveMarketReading(
  db: Db,
  userId: string,
  propertyId: string,
  reading: (MarketReading & { quarter: string }) | null,
): Promise<ActionResult> {
  const { error } = reading
    ? await db.from("property_market_readings").upsert({
        property_id: propertyId,
        user_id: userId,
        scope: reading.scope,
        median_m2: reading.medianM2,
        q1_m2: reading.q1M2,
        q3_m2: reading.q3M2,
        sales: reading.sales,
        period_from: reading.periodFrom,
        period_to: reading.periodTo,
        quarter: reading.quarter,
        read_at: new Date().toISOString(),
      })
    : await db
        .from("property_market_readings")
        .delete()
        .eq("property_id", propertyId)
        .eq("user_id", userId);
  return error ? { error: dbError(error) } : { success: true };
}

/**
 * Keep a let property's asking rents, or forget them when it is no longer
 * let or the ANIL no longer gives a reliable figure there. The user's
 * client under RLS, or the service role from the market cron.
 */
export async function saveRentReference(
  db: Db,
  userId: string,
  propertyId: string,
  reference: RentReference | null,
): Promise<ActionResult> {
  const { error } = reference
    ? await db.from("property_rent_references").upsert({
        property_id: propertyId,
        user_id: userId,
        series: reference.series,
        rent_m2: reference.rentM2,
        low_m2: reference.lowM2,
        high_m2: reference.highM2,
        scope: reference.scope,
        observations: reference.observations,
        edition: reference.edition,
        read_at: new Date().toISOString(),
      })
    : await db
        .from("property_rent_references")
        .delete()
        .eq("property_id", propertyId)
        .eq("user_id", userId);
  return error && !isMissingSchema(error)
    ? { error: dbError(error) }
    : { success: true };
}

/**
 * Give a let property its rent: a monthly income template attached to it,
 * on the first of the month from today, filed under this category name
 * (found in either language, or created). Changed afterwards on Récurrents,
 * like any other.
 */
export async function addRent(
  db: Db,
  userId: string,
  input: {
    propertyId: string;
    amount: number;
    categoryName: string;
    description: string;
  },
): Promise<ActionResult<{ templateId: string }>> {
  if (!uuid.safeParse(input.propertyId).success) {
    return { error: "errors.invalidInput" };
  }
  if (!(Number.isFinite(input.amount) && input.amount > 0)) {
    return { error: "errors.amountPositive" };
  }
  const category = await categoryNamed(
    db,
    userId,
    input.categoryName,
    "income",
    "house",
  );
  if ("error" in category) {
    return { error: category.error };
  }
  const template = await saveRecurringTemplate(db, userId, {
    categoryId: category.id,
    description: input.description,
    pricingType: "fixed",
    amount: cents(input.amount),
    recurrence: "monthly",
    dayOfMonth: 1,
    startsOn: todayIsoLocal(),
    endsOn: undefined,
    propertyId: input.propertyId,
  });
  return "error" in template
    ? { error: template.error }
    : { success: true, templateId: template.templateId };
}

/** Write the price index INSEE answered. The service role only. */
export async function savePriceIndex(
  db: Db,
  rows: readonly { series: string; quarter: string; value: number }[],
): Promise<ActionResult<{ saved: number }>> {
  const now = new Date().toISOString();
  for (let start = 0; start < rows.length; start += 500) {
    const { error } = await db
      .from("housing_price_index")
      .upsert(
        rows
          .slice(start, start + 500)
          .map((row) => ({ ...row, updated_at: now })),
      );
    if (error) {
      return { error: dbError(error) };
    }
  }
  return { success: true, saved: rows.length };
}

import { firstIssue, type ActionResult } from "@finance/core/action-result";
import { categoryNameVariants } from "@finance/core/constants";
import {
  cents,
  loanSchedule,
  monthlyOutlay,
  regularPayment,
} from "@finance/core/loan-schedule";
import { loanTermsFromRow } from "@finance/core/property";
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
  monthOfYear: number | null;
  endsOn: string | null;
  active: boolean;
  categoryName: string;
  categoryType: CategoryType;
}

export interface PropertyRead {
  property: Property;
  loans: PropertyLoan[];
  templates: AttachedTemplate[];
}

export interface PropertiesState {
  /** Oldest purchase first. */
  properties: PropertyRead[];
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

/* ------------------------------------------------------------------ reading */

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
      return { properties: [], available: false };
    }
    throw error;
  }
  const properties = (rows ?? []).map(propertyFromRow);
  if (properties.length === 0) {
    return { properties: [], available: true };
  }

  const ids = properties.map((property) => property.id);
  const [loans, templates] = await Promise.all([
    db
      .from("property_loans")
      .select("*")
      .eq("user_id", userId)
      .in("property_id", ids)
      .order("created_at"),
    db
      .from("recurring_templates")
      .select(
        "id, property_id, description, amount, recurrence, day_of_month, month_of_year, ends_on, active, categories(name, type)",
      )
      .eq("user_id", userId)
      .in("property_id", ids)
      .order("created_at"),
  ]);
  if (loans.error) {
    throw loans.error;
  }
  if (templates.error) {
    throw templates.error;
  }

  return {
    available: true,
    properties: properties.map((property) => ({
      property,
      loans: (loans.data ?? [])
        .filter((loan) => loan.property_id === property.id)
        .map(loanFromRow),
      templates: (templates.data ?? [])
        .filter((template) => template.property_id === property.id)
        .map((template): AttachedTemplate => ({
          id: template.id,
          description: template.description,
          amount: Number(template.amount),
          recurrence: template.recurrence,
          dayOfMonth: template.day_of_month,
          monthOfYear: template.month_of_year,
          endsOn: template.ends_on,
          active: template.active,
          categoryName: template.categories?.name ?? "",
          categoryType: template.categories?.type ?? "expense",
        })),
    })),
  };
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
    rooms: data.rooms,
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
 * The user's expense category of this name, in either language, or a new
 * one under it. Where a loan's payment is filed.
 */
async function paymentCategory(
  db: Db,
  userId: string,
  name: string,
): Promise<{ id: string } | { error: string }> {
  const { data: found, error } = await db
    .from("categories")
    .select("id, name")
    .eq("user_id", userId)
    .eq("type", "expense")
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
    .insert({ user_id: userId, name, type: "expense", icon: "bank" })
    .select("id")
    .single();
  if (createError || !created) {
    return {
      error: createError ? dbError(createError) : "errors.couldNotSave",
    };
  }
  return { id: created.id };
}

async function linkTemplate(
  db: Db,
  userId: string,
  loan: { id: string; property_id: string },
  templateId: string,
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
      recurring_template_id: templateId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", loan.id)
    .eq("user_id", userId);
  return error ? { error: dbError(error) } : { success: true };
}

export interface LoanPaymentOptions {
  /**
   * Write a monthly template for the loan's payment: the user's share of the
   * regular payment and its insurance, from the first regular payment to
   * the last, filed under this category name (found in either language, or
   * created).
   */
  addPayment?: { categoryName: string; description: string };
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

  if (!options.addPayment || loan.recurring_template_id) {
    return {
      success: true,
      loanId: loan.id,
      templateId: loan.recurring_template_id,
    };
  }

  const terms = loanTermsFromRow(loan);
  const schedule = loanSchedule(terms);
  const first = regularPayment(terms, schedule);
  const last = schedule.at(-1);
  if (!first || !last) {
    return { success: true, loanId: loan.id, templateId: null };
  }

  const category = await paymentCategory(
    db,
    userId,
    options.addPayment.categoryName,
  );
  if ("error" in category) {
    return { error: category.error };
  }
  const template = await saveRecurringTemplate(db, userId, {
    categoryId: category.id,
    description: options.addPayment.description,
    pricingType: "fixed",
    amount: cents(monthlyOutlay(terms, schedule) * loan.borrower_share),
    recurrence: "monthly",
    dayOfMonth: Number(first.on.slice(8, 10)),
    startsOn: first.on,
    endsOn: last.on,
  });
  if ("error" in template) {
    return { error: template.error };
  }
  const linked = await linkTemplate(db, userId, loan, template.templateId);
  return linked.error
    ? { error: linked.error }
    : { success: true, loanId: loan.id, templateId: template.templateId };
}

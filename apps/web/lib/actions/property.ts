"use server";

import type { ActionResult } from "@finance/core/action-result";
import {
  searchAddresses,
  type AddressMatch,
} from "@finance/core/address-search";
import { formatEuro } from "@finance/core/constants";
import { loanPaymentCategoryName } from "@finance/core/property";
import * as properties from "@finance/data/properties";
import { asUser } from "@/lib/actions/as-user";
import { getAuthUser } from "@/lib/auth/get-user";
import { getLocale, getT } from "@/lib/locale";

/**
 * Adding and changing properties and their loans, on the web. The writes are
 * `@finance/data/properties`, shared with the phone; what is left here is
 * the web's plumbing and the sentences its toasts say.
 */

/**
 * Addresses for what the reader has typed so far, asked of the geocoder from
 * here rather than from their browser, so it never learns who asked.
 */
export async function findAddresses(query: string): Promise<AddressMatch[]> {
  if (!(await getAuthUser())) {
    return [];
  }
  return searchAddresses(query);
}

/**
 * Add a property, and the loan that paid for it when there was one, with
 * its payment among the recurring entries when asked. A loan that cannot be
 * saved takes the property back with it, so trying again does not leave the
 * same home twice.
 */
export async function addProperty(input: {
  property: properties.PropertyChange;
  loan: Omit<properties.LoanChange, "propertyId"> | null;
  addPayment: boolean;
}): Promise<ActionResult<{ propertyId: string }>> {
  const t = await getT();
  const locale = await getLocale();
  const categoryName = loanPaymentCategoryName(locale);

  return asUser<{ propertyId: string }>(async (db, userId) => {
    const saved = await properties.saveProperty(db, userId, input.property);
    if (!saved.success) {
      return { error: saved.error };
    }
    const { propertyId } = saved;
    const name = String(input.property.name).trim();

    if (!input.loan) {
      return {
        success: true,
        propertyId,
        message: t("property.added", { name }),
      };
    }

    const loan = await properties.saveLoan(
      db,
      userId,
      { ...input.loan, propertyId },
      input.addPayment
        ? {
            addPayment: {
              categoryName,
              description: `${String(input.loan.label).trim()} · ${name}`,
            },
          }
        : {},
    );
    if (!loan.success) {
      await properties.deleteProperty(db, userId, propertyId);
      return { error: loan.error };
    }

    if (!loan.templateId) {
      return {
        success: true,
        propertyId,
        message: t("property.added", { name }),
      };
    }
    const { data: template } = await db
      .from("recurring_templates")
      .select("amount")
      .eq("id", loan.templateId)
      .maybeSingle();
    return {
      success: true,
      propertyId,
      message: t("property.addedWithPayment", {
        name,
        amount: formatEuro(Number(template?.amount ?? 0), locale),
      }),
    };
  });
}

/** The user's own estimate of what a property is worth, or none. */
export async function setOwnValue(
  propertyId: string,
  value: number | null,
): Promise<ActionResult> {
  const t = await getT();
  return asUser(async (db, userId): Promise<ActionResult> => {
    const result = await properties.setPropertyValue(
      db,
      userId,
      propertyId,
      value,
    );
    return result.success
      ? { success: true, message: t("property.saved") }
      : { error: result.error };
  });
}

export async function removeProperty(
  propertyId: string,
  name: string,
): Promise<ActionResult> {
  const t = await getT();
  return asUser(async (db, userId): Promise<ActionResult> => {
    const result = await properties.deleteProperty(db, userId, propertyId);
    return result.success
      ? { success: true, message: t("property.removed", { name }) }
      : { error: result.error };
  });
}

/** What the bank says is still owed on a loan, or back to the schedule. */
export async function updateKnownOutstanding(
  loanId: string,
  known: { outstanding: number; on: string; keeps: "payment" | "term" } | null,
): Promise<ActionResult> {
  const t = await getT();
  return asUser(async (db, userId): Promise<ActionResult> => {
    const result = await properties.setLoanKnownOutstanding(
      db,
      userId,
      loanId,
      known,
    );
    return result.success
      ? { success: true, message: t("property.saved") }
      : { error: result.error };
  });
}

/** Bring a loan's payment template in line with its schedule. */
export async function syncPayment(loanId: string): Promise<ActionResult> {
  const t = await getT();
  return asUser(async (db, userId): Promise<ActionResult> => {
    const result = await properties.syncLoanPayment(db, userId, loanId);
    return result.success
      ? { success: true, message: t("property.paymentSynced") }
      : { error: result.error };
  });
}

/** Give a loan saved without one its payment among the recurring entries. */
export async function addPaymentForLoan(
  loanId: string,
  description: string,
): Promise<ActionResult> {
  const t = await getT();
  const categoryName = loanPaymentCategoryName(await getLocale());
  return asUser(async (db, userId): Promise<ActionResult> => {
    const result = await properties.addLoanPayment(db, userId, loanId, {
      categoryName,
      description,
    });
    return result.success
      ? { success: true, message: t("property.paymentAdded") }
      : { error: result.error };
  });
}

export async function removeLoan(loanId: string): Promise<ActionResult> {
  return asUser((db, userId) => properties.deleteLoan(db, userId, loanId));
}

/** Change what was said about a property. */
export async function updateProperty(
  input: properties.PropertyChange,
): Promise<ActionResult> {
  const t = await getT();
  return asUser(async (db, userId): Promise<ActionResult> => {
    const result = await properties.saveProperty(db, userId, input);
    return result.success
      ? { success: true, message: t("property.saved") }
      : { error: result.error };
  });
}

/**
 * Add a loan to a property, with its payment among the recurring entries
 * when asked, or change one's terms.
 */
export async function saveLoanForProperty(
  input: properties.LoanChange,
  addPayment: boolean,
  description: string,
): Promise<ActionResult> {
  const t = await getT();
  const categoryName = loanPaymentCategoryName(await getLocale());
  return asUser(async (db, userId): Promise<ActionResult> => {
    const result = await properties.saveLoan(
      db,
      userId,
      input,
      addPayment ? { addPayment: { categoryName, description } } : {},
    );
    if (!result.success) {
      return { error: result.error };
    }
    return {
      success: true,
      message: input.id
        ? t("property.loanSaved")
        : result.templateId && addPayment
          ? t("property.loanAddedWithPayment")
          : t("property.loanAdded"),
    };
  });
}

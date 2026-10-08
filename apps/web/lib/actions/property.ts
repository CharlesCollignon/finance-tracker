"use server";

import type { ActionResult } from "@finance/core/action-result";
import {
  searchAddresses,
  type AddressMatch,
} from "@finance/core/address-search";
import { formatEuro, RENT_CATEGORY_NAMES } from "@finance/core/constants";
import { loanPaymentCategoryName } from "@finance/core/property";
import * as properties from "@finance/data/properties";
import { asOwner } from "@/lib/actions/as-user";
import {
  readPropertyMarketSoon,
  type MarketOutcome,
} from "@/lib/property-market/read";
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

interface AddedProperty {
  propertyId: string;
  /** "later" when the market is still being read, after the response. */
  reading: MarketOutcome | "later";
}

/**
 * Add a property, and the loan that paid for it when there was one, with
 * its payment among the recurring entries when asked.
 */
export async function addProperty(input: {
  property: properties.PropertyChange;
  loan: Omit<properties.LoanChange, "propertyId"> | null;
  addPayment: boolean;
}): Promise<ActionResult<AddedProperty>> {
  const t = await getT();
  const locale = await getLocale();

  return asOwner<AddedProperty>(async (db, userId) => {
    const result = await properties.addPropertyWithLoan(db, userId, {
      property: input.property,
      loan: input.loan,
      payment:
        input.loan && input.addPayment
          ? {
              categoryName: loanPaymentCategoryName(locale),
              insuranceLabel: t("property.insuranceWord"),
            }
          : null,
    });
    if (!result.success) {
      return { error: result.error };
    }
    // What the market says, while the sheet waits — or after the response,
    // for the property's page to pick up.
    const reading = await readPropertyMarketSoon(db, userId, result.propertyId);
    const name = String(input.property.name).trim();
    return {
      success: true,
      propertyId: result.propertyId,
      reading,
      message:
        result.paymentAmount === null
          ? t("property.added", { name })
          : t("property.addedWithPayment", {
              name,
              amount: formatEuro(result.paymentAmount, locale),
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
  return asOwner(async (db, userId): Promise<ActionResult> => {
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
  return asOwner(async (db, userId): Promise<ActionResult> => {
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
  return asOwner(async (db, userId): Promise<ActionResult> => {
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
  return asOwner(async (db, userId): Promise<ActionResult> => {
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
  return asOwner(async (db, userId): Promise<ActionResult> => {
    const result = await properties.addLoanPayment(db, userId, loanId, {
      categoryName,
      description,
      insuranceLabel: t("property.insuranceWord"),
    });
    return result.success
      ? { success: true, message: t("property.paymentAdded") }
      : { error: result.error };
  });
}

/**
 * Link one of the user's recurring entries to a loan's payment, or to its
 * insurance debited apart — « C'est celle-ci ? ».
 */
export async function linkLoanEntry(
  loanId: string,
  templateId: string,
  debit: properties.LoanDebit,
): Promise<ActionResult> {
  const t = await getT();
  return asOwner(async (db, userId): Promise<ActionResult> => {
    const result = await properties.linkLoanTemplate(db, userId, {
      loanId,
      templateId,
      debit,
    });
    return result.success
      ? { success: true, message: t("property.entryLinked") }
      : { error: result.error };
  });
}

/** Give a let property its rent among the recurring entries. */
export async function addRentForProperty(
  propertyId: string,
  amount: number,
  propertyName: string,
): Promise<ActionResult> {
  const t = await getT();
  const locale = await getLocale();
  return asOwner(async (db, userId): Promise<ActionResult> => {
    const result = await properties.addRent(db, userId, {
      propertyId,
      amount,
      categoryName: RENT_CATEGORY_NAMES[locale],
      description: t("property.rentDescription", { name: propertyName }),
    });
    return result.success
      ? { success: true, message: t("property.rentAdded") }
      : { error: result.error };
  });
}

export async function removeLoan(loanId: string): Promise<ActionResult> {
  return asOwner((db, userId) => properties.deleteLoan(db, userId, loanId));
}

/** Change what was said about a property. */
export async function updateProperty(
  input: properties.PropertyChange,
): Promise<ActionResult<{ reading: MarketOutcome | "later" }>> {
  const t = await getT();
  return asOwner<{ reading: MarketOutcome | "later" }>(async (db, userId) => {
    const result = await properties.saveProperty(db, userId, input);
    if (!result.success) {
      return { error: result.error };
    }
    // A new place, kind or area is a new reading.
    const reading = await readPropertyMarketSoon(db, userId, result.propertyId);
    return { success: true, reading, message: t("property.saved") };
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
  return asOwner(async (db, userId): Promise<ActionResult> => {
    const result = await properties.saveLoan(
      db,
      userId,
      input,
      addPayment
        ? {
            addPayment: {
              categoryName,
              description,
              insuranceLabel: t("property.insuranceWord"),
            },
          }
        : {},
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

/**
 * How much a year a property is expected to gain, for the long view. Kept
 * quietly, as the long view's own figures are: the card already shows it,
 * and a redraw would put the long view back behind its placeholder.
 */
export async function setGrowth(
  propertyId: string,
  growth: number | null,
): Promise<ActionResult> {
  return asOwner(
    (db, userId) =>
      properties.setPropertyGrowth(db, userId, propertyId, growth),
    { redraw: "never" },
  );
}

/** My part of a joint home's deed; the partner's is the rest (6c). */
export async function setPropertyShareAction(
  propertyId: string,
  share: number,
): Promise<ActionResult> {
  return asOwner((db) => properties.setPropertyShare(db, propertyId, share));
}

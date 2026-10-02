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

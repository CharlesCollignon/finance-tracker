"use server";

import { revalidatePath } from "next/cache";
import type { ActionResult } from "@finance/core/action-result";
import { CATEGORY_BOXES, type TaxBoxId } from "@finance/core/tax-return";
import { setTaxBox } from "@finance/data/tax-return";
import { asUser } from "@/lib/actions/as-user";

/**
 * File one of the person's categories in a box of the return, or take it out
 * (`box` null). Always the person's own: a space files no return.
 */
export async function setTaxBoxAction(
  categoryId: string,
  box: TaxBoxId | null,
): Promise<ActionResult> {
  if (box !== null && !CATEGORY_BOXES.includes(box)) {
    return { error: "errors.invalidInput" };
  }
  const result = await asUser(
    (db, userId) => setTaxBox(db, userId, categoryId, box),
    { redraw: "never" },
  );
  revalidatePath("/tax");
  return result;
}

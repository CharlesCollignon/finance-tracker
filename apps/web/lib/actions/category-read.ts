"use server";

import { revalidatePath } from "next/cache";
import { parseUuid } from "@finance/core/validations/finance";
import { getAuthUser } from "@/lib/auth/get-user";
import { writeCategoryRead } from "@/lib/category-read/write";

/**
 * Write a category read from the panel.
 *
 * The same split `lib/actions/month-read.ts` uses: a server action for the
 * web, one shared implementation underneath. Only the by-category screen is
 * revalidated — a read changes nothing anywhere else.
 */
export async function writeCategoryReadAction(
  categoryId: string,
): Promise<{ written: boolean; message: string | null; writesLeft: number }> {
  const user = await getAuthUser();
  if (!user) {
    return {
      written: false,
      message: "errors.notAuthenticated",
      writesLeft: 0,
    };
  }

  const parsed = parseUuid(categoryId);
  if (!parsed) {
    return { written: false, message: "Invalid category", writesLeft: 0 };
  }

  const outcome = await writeCategoryRead(user.id, parsed);

  if (outcome.written) {
    revalidatePath("/history");
  }

  return outcome;
}

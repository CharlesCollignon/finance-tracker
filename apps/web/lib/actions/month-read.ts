"use server";

import { revalidateApp } from "@/lib/revalidate-paths";
import { monthReadRequestSchema } from "@finance/core/validations/month-read";
import { getOwner } from "@/lib/owner";
import { writeMonthRead } from "@/lib/month-read/write";

/**
 * Write a month read from the web card.
 *
 * The same split the bank refresh uses: a server action for the web, a
 * bearer route for the phone, one shared implementation underneath. Only the
 * Month page is revalidated — a read changes nothing anywhere else.
 */
export async function writeMonthReadAction(
  year: number,
  month: number,
): Promise<{ written: boolean; message: string | null; writesLeft: number }> {
  const owner = await getOwner();
  if (!owner) {
    return {
      written: false,
      message: "errors.notAuthenticated",
      writesLeft: 0,
    };
  }

  const parsed = monthReadRequestSchema.safeParse({ year, month });
  if (!parsed.success) {
    return { written: false, message: "errors.invalidInput", writesLeft: 0 };
  }

  // The owner's month — the person's, or their space's — written with the
  // asking person's AI account.
  const outcome = await writeMonthRead(
    owner.ownerId,
    parsed.data.year,
    parsed.data.month,
    undefined,
    owner.userId,
  );

  if (outcome.written) {
    revalidateApp();
  }

  return outcome;
}

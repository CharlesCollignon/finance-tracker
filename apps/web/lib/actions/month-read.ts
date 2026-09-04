"use server";

import { revalidatePath } from "next/cache";
import { monthReadRequestSchema } from "@finance/core/validations/month-read";
import { getAuthUser } from "@/lib/auth/get-user";
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
  const user = await getAuthUser();
  if (!user) {
    return { written: false, message: "Not authenticated", writesLeft: 0 };
  }

  const parsed = monthReadRequestSchema.safeParse({ year, month });
  if (!parsed.success) {
    return { written: false, message: "Invalid month", writesLeft: 0 };
  }

  const outcome = await writeMonthRead(
    user.id,
    parsed.data.year,
    parsed.data.month,
  );

  if (outcome.written) {
    revalidatePath("/dashboard");
  }

  return outcome;
}

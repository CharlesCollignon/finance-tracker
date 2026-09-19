"use server";

import { revalidatePath } from "next/cache";
import { parseUuid } from "@finance/core/validations/finance";
import { getAuthUser } from "@/lib/auth/get-user";
import { writeCategoryRead } from "@/lib/category-read/write";
import { rerankFindings } from "@/lib/category-selection/write";

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
    // The same fallback `upsertCategory` and its siblings use for malformed
    // input: a key, not a sentence, so a French reader is not shown English
    // — the toast resolves it the same way it resolves `errors.notAuthenticated`
    // just above.
    return { written: false, message: "errors.invalidInput", writesLeft: 0 };
  }

  const outcome = await writeCategoryRead(user.id, parsed);

  if (outcome.written) {
    revalidatePath("/history");
  }

  return outcome;
}

/**
 * Ask a model which findings should lead.
 *
 * Takes nothing. The findings are rebuilt from the database inside — a
 * catalogue the client supplied is a catalogue the client chose, and the
 * closed-catalogue rule the whole call rests on would mean nothing. There is
 * therefore no input to validate, which is why this has no `parseUuid`
 * sibling to the action above.
 */
export async function rerankFindingsAction(): Promise<{
  written: boolean;
  message: string | null;
  writesLeft: number;
}> {
  const user = await getAuthUser();
  if (!user) {
    return {
      written: false,
      message: "errors.notAuthenticated",
      writesLeft: 0,
    };
  }

  const outcome = await rerankFindings(user.id);

  if (outcome.written) {
    revalidatePath("/history");
  }

  return outcome;
}

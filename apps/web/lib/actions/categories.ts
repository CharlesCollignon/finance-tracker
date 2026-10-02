"use server";

import type { ActionResult, FormState } from "@finance/core/action-result";
import * as categories from "@finance/data/categories";
import { asUser } from "@/lib/actions/as-user";

export async function upsertCategory(
  _prev: FormState,
  formData: FormData,
): Promise<ActionResult> {
  return asUser((db, userId) =>
    categories.upsertCategory(db, userId, {
      id: (formData.get("id") as string | null) || undefined,
      name: String(formData.get("name") ?? ""),
      type: formData.get("type") as categories.CategoryChange["type"],
      icon: (formData.get("icon") as string | null) || undefined,
      countsTowardSummary: formData.get("countsTowardSummary") !== "false",
    }),
  );
}

export async function setCategoryArchived(
  id: string,
  archived: boolean,
): Promise<ActionResult> {
  return asUser((db, userId) =>
    categories.setCategoryArchived(db, userId, id, archived),
  );
}

export async function deleteCategory(id: string): Promise<ActionResult> {
  return asUser((db, userId) => categories.deleteCategory(db, userId, id));
}

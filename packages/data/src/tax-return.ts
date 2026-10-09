import { matchWalletId } from "@finance/core/investments";
import { allRows } from "@finance/core/paging";
import { isLet } from "@finance/core/rental";
import type { TaxBoxId, TaxRow } from "@finance/core/tax-return";
import type { ActionResult } from "@finance/core/action-result";
import type { CategoryType, PropertyUsage } from "@finance/core/types/database";

import type { Db } from "./client";
import { dbError } from "./errors";
import { isMissingSchema } from "./schema";

/**
 * The tax return page's reads and its one write (migration 066): which box
 * each category was filed in, and a year's rows, each knowing whether it
 * pays into a PER or is a let property's rent.
 */

/** The categories the person filed in a box, by category. */
export async function getTaxBoxes(
  db: Db,
  userId: string,
): Promise<Map<string, TaxBoxId>> {
  const { data, error } = await db
    .from("tax_box_categories")
    .select("category_id, box")
    .eq("user_id", userId);
  if (error) {
    if (isMissingSchema(error)) {
      return new Map();
    }
    throw error;
  }
  return new Map(
    (data ?? []).map((row) => [row.category_id, row.box as TaxBoxId]),
  );
}

/** File a category in a box, or take it out of any (`box` null). */
export async function setTaxBox(
  db: Db,
  userId: string,
  categoryId: string,
  box: TaxBoxId | null,
): Promise<ActionResult> {
  const { error } = box
    ? await db
        .from("tax_box_categories")
        .upsert(
          { user_id: userId, category_id: categoryId, box },
          { onConflict: "user_id,category_id" },
        )
    : await db
        .from("tax_box_categories")
        .delete()
        .eq("user_id", userId)
        .eq("category_id", categoryId);
  return error ? { error: dbError(error) } : { success: true };
}

/**
 * A year's rows as the page sums them: each with its category, the wallet
 * an investment pays into, and — for a rent recorded through a property's
 * recurring entry — whether that property is let bare or furnished.
 */
export async function readTaxRows(
  db: Db,
  userId: string,
  year: number,
): Promise<TaxRow[]> {
  const [rows, { data: templates }, { data: properties }, { data: positions }] =
    await Promise.all([
      allRows((from, to) =>
        db
          .from("transactions")
          .select(
            "id, occurred_on, amount, note, category_id, recurring_template_id, categories(name, type)",
          )
          .eq("user_id", userId)
          .gte("occurred_on", `${year}-01-01`)
          .lte("occurred_on", `${year}-12-31`)
          .order("occurred_on")
          .order("id")
          .range(from, to),
      ),
      db
        .from("recurring_templates")
        .select("id, property_id")
        .eq("user_id", userId)
        .not("property_id", "is", null),
      db.from("properties").select("id, usage").eq("user_id", userId),
      // Which wallet an investment category pays into: its positions say.
      db
        .from("investment_positions")
        .select("category_id, wallet")
        .eq("user_id", userId)
        .not("category_id", "is", null),
    ]);

  const walletOf = new Map(
    (positions ?? []).map((row) => [row.category_id as string, row.wallet]),
  );

  const usageOf = new Map(
    (properties ?? []).map((row) => [row.id, row.usage as PropertyUsage]),
  );
  const letBy = new Map<string, "bare" | "furnished">();
  for (const template of templates ?? []) {
    const usage = template.property_id
      ? usageOf.get(template.property_id)
      : undefined;
    if (usage && isLet(usage)) {
      letBy.set(
        template.id,
        usage === "rental_furnished" ? "furnished" : "bare",
      );
    }
  }

  return rows.map((row) => {
    const category = row.categories as { name: string; type: CategoryType };
    return {
      id: row.id,
      occurredOn: row.occurred_on,
      amount: Number(row.amount),
      note: row.note,
      categoryId: row.category_id,
      categoryName: category.name,
      categoryType: category.type,
      walletId:
        category.type === "investment"
          ? (walletOf.get(row.category_id) ??
            matchWalletId(category.name) ??
            (/\bPER\b/i.test(category.name) ? "per" : null))
          : null,
      rent:
        category.type === "income" && row.recurring_template_id
          ? (letBy.get(row.recurring_template_id) ?? null)
          : null,
    };
  });
}

import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import {
  buildMerchantIndex,
  type MerchantRule,
} from "@finance/core/merchant-memory";
import type {
  Category,
  Tag,
  TransactionWithCategory,
} from "@finance/core/types/database";

/**
 * How far back the app looks to learn habits. Far enough that a monthly
 * merchant is seen several times, short enough that a year-old category
 * choice does not outvote how the user files things now.
 */
const HISTORY_LIMIT = 400;

/** Chips offered before the user searches. Four fits one row on a phone. */
const RECENT_CATEGORY_COUNT = 4;

export interface QuickEntryContext {
  categories: Category[];
  tags: Tag[];
  /** Most recently used category ids, newest first. */
  recentCategoryIds: string[];
  /** Merchant rules as an array — Maps do not survive the RSC boundary well. */
  merchants: MerchantRule[];
}

/**
 * Everything the quick-add sheet needs to open instantly.
 *
 * Fetched once in the app layout rather than per page, because the sheet is
 * reachable from every screen and a spinner inside an add form defeats the
 * point of making it fast.
 */
export const getQuickEntryContext = cache(
  async (userId: string): Promise<QuickEntryContext> => {
    const supabase = await createClient();

    const [categoriesResult, tagsResult, historyResult] = await Promise.all([
      supabase
        .from("categories")
        .select("*")
        .eq("user_id", userId)
        .eq("archived", false)
        .order("name"),
      supabase.from("tags").select("*").eq("user_id", userId).order("name"),
      supabase
        .from("transactions")
        .select("*, categories(name, type, icon, counts_toward_summary)")
        .eq("user_id", userId)
        .order("occurred_on", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(HISTORY_LIMIT),
    ]);

    if (categoriesResult.error) {
      throw categoriesResult.error;
    }
    if (tagsResult.error) {
      throw tagsResult.error;
    }
    if (historyResult.error) {
      throw historyResult.error;
    }

    const history = (historyResult.data ?? []) as TransactionWithCategory[];

    const recentCategoryIds: string[] = [];
    for (const tx of history) {
      if (!recentCategoryIds.includes(tx.category_id)) {
        recentCategoryIds.push(tx.category_id);
      }
      if (recentCategoryIds.length >= RECENT_CATEGORY_COUNT) {
        break;
      }
    }

    return {
      categories: (categoriesResult.data ?? []) as Category[],
      tags: (tagsResult.data ?? []) as Tag[],
      recentCategoryIds,
      merchants: [...buildMerchantIndex(history).values()],
    };
  },
);

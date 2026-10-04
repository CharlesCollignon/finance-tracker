import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import * as positions from "@finance/data/positions";
import type { WalletPlan } from "@finance/core/types/database";
import type { InvestmentPositionRow } from "@finance/core/investment-positions";
import type { InvestmentWalletId } from "@finance/core/investments";

export const getInvestmentPositions = cache(
  async (userId: string): Promise<InvestmentPositionRow[]> =>
    positions.getInvestmentPositions(await createClient(), userId),
);

export async function upsertInvestmentPosition(
  userId: string,
  payload: {
    positionId: string | null;
    wallet: InvestmentWalletId;
    recurringTemplateId: string | null;
    name: string;
    categoryId: string | null;
    initialBalance: number;
    currentValue: number | null;
    shareCount: number | null;
    instrumentSymbol: string | null;
    instrumentName: string | null;
    ongoingCharge: number | null;
    isin: string | null;
    valuePinned: boolean;
  },
): Promise<void> {
  const supabase = await createClient();
  const row = {
    user_id: userId,
    wallet: payload.wallet,
    recurring_template_id: payload.recurringTemplateId,
    name: payload.name,
    category_id: payload.categoryId,
    initial_balance: payload.initialBalance,
    current_value: payload.currentValue,
    share_count: payload.shareCount,
    instrument_symbol: payload.instrumentSymbol,
    instrument_name: payload.instrumentName,
    ongoing_charge: payload.ongoingCharge,
    isin: payload.isin,
    value_pinned: payload.valuePinned,
    updated_at: new Date().toISOString(),
  };

  if (payload.positionId) {
    const { error } = await supabase
      .from("investment_positions")
      .update(row)
      .eq("id", payload.positionId)
      .eq("user_id", userId);

    if (error) {
      throw error;
    }

    return;
  }

  const { error } = await supabase.from("investment_positions").insert(row);

  if (error) {
    throw error;
  }
}

export async function deleteInvestmentPosition(
  userId: string,
  positionId: string,
): Promise<void> {
  const supabase = await createClient();

  const { error } = await supabase
    .from("investment_positions")
    .delete()
    .eq("id", positionId)
    .eq("user_id", userId);

  if (error) {
    throw error;
  }
}

/**
 * The user's plan for each wallet: target weights and opening dates.
 *
 * Rows are created lazily, so a user who has never set a target simply has
 * none — which is the right default, since drift against an unstated target is
 * not a thing worth showing.
 */
export async function getWalletPlans(userId: string): Promise<WalletPlan[]> {
  return positions.getWalletPlans(await createClient(), userId);
}

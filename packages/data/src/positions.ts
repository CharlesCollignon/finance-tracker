import type { InvestmentPositionRow } from "@finance/core/investment-positions";
import type {
  InvestmentPosition,
  WalletPlan,
} from "@finance/core/types/database";

import type { Db } from "./client";

/**
 * What the wallets hold, and what each one is planned to receive, for both
 * apps.
 *
 * The phone's copy of the positions read dropped two columns the web's
 * kept: the ISIN, which the look-through reads a fund by, and whether the
 * user pinned a position's value — the figure that is meant to outrank the
 * market. Without it the phone valued a pinned position at its quote, and
 * the two apps showed different totals for the same wallet.
 */

function toPositionRow(row: InvestmentPosition): InvestmentPositionRow {
  return {
    id: row.id,
    wallet: row.wallet,
    recurring_template_id: row.recurring_template_id,
    name: row.name,
    category_id: row.category_id,
    initial_balance: Number(row.initial_balance),
    current_value:
      row.current_value === null ? null : Number(row.current_value),
    share_count: row.share_count,
    instrument_symbol: row.instrument_symbol,
    instrument_name: row.instrument_name,
    // Dropping this was not only a blank on the look-through: the position
    // sheet seeds its field from the mapped row and posts it back, so every
    // save wrote an empty ISIN over a good one.
    isin: row.isin ?? null,
    value_pinned: row.value_pinned ?? false,
    ongoing_charge:
      row.ongoing_charge === null ? null : Number(row.ongoing_charge),
  };
}

/** Every position, by wallet then name. */
export async function getInvestmentPositions(
  db: Db,
  userId: string,
): Promise<InvestmentPositionRow[]> {
  const { data, error } = await db
    .from("investment_positions")
    .select("*")
    .eq("user_id", userId)
    .order("wallet")
    .order("name");

  if (error) {
    throw error;
  }
  return ((data ?? []) as InvestmentPosition[]).map(toPositionRow);
}

/** Each wallet's plan: what it is meant to receive, and its targets. */
export async function getWalletPlans(
  db: Db,
  userId: string,
): Promise<WalletPlan[]> {
  const { data, error } = await db
    .from("wallet_plans")
    .select("*")
    .eq("user_id", userId);

  if (error) {
    throw error;
  }
  return (data ?? []) as WalletPlan[];
}

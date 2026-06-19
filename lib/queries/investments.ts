import { createClient } from "@/lib/supabase/server";
import { fetchInstrumentQuote } from "@/lib/market/yahoo";
import type { InvestmentPosition } from "@/lib/types/database";
import type { InvestmentPositionRow } from "@/lib/investment-positions";
import type { InvestmentWalletId } from "@/lib/investments";

function mapRow(row: InvestmentPosition): InvestmentPositionRow {
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
  };
}

export async function getInvestmentPositions(
  userId: string,
): Promise<InvestmentPositionRow[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("investment_positions")
    .select("*")
    .eq("user_id", userId)
    .order("wallet")
    .order("name");

  if (error) {
    throw error;
  }

  return ((data ?? []) as InvestmentPosition[]).map(mapRow);
}

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

export async function fetchLiveQuotes(
  symbols: string[],
): Promise<Record<string, number>> {
  const unique = Array.from(new Set(symbols.filter(Boolean)));
  const quotes: Record<string, number> = {};

  await Promise.all(
    unique.map(async (symbol) => {
      try {
        const quote = await fetchInstrumentQuote(symbol);
        quotes[symbol] = quote.price;
      } catch {
        // Ignore failed quotes — fall back to invested value.
      }
    }),
  );

  return quotes;
}

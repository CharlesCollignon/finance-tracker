import type { SupabaseClient } from "@supabase/supabase-js";
import { displayNameForRecurringTemplate } from "@finance/core/investment-positions";
import { BITCOIN_INSTRUMENT, isCryptoWallet } from "@finance/core/crypto-holdings";
import { resolveWalletId } from "@finance/core/investments";
import type { Database, RecurringTemplateWithCategory } from "@finance/core/types/database";

type Client = SupabaseClient<Database>;

function isDeploymentInvestment(
  template: RecurringTemplateWithCategory,
): boolean {
  return (
    template.categories.type === "investment" &&
    template.categories.counts_toward_summary === false
  );
}

export async function syncInvestmentPositionFromRecurring(
  supabase: Client,
  userId: string,
  templateId: string,
): Promise<void> {
  const { data: template, error } = await supabase
    .from("recurring_templates")
    .select(
      "*, categories(name, type, icon, counts_toward_summary)",
    )
    .eq("id", templateId)
    .eq("user_id", userId)
    .single();

  if (error || !template) {
    return;
  }

  const row = template as RecurringTemplateWithCategory;
  if (!isDeploymentInvestment(row)) {
    return;
  }

  const wallet = resolveWalletId(row.categories.name);
  const name = displayNameForRecurringTemplate(row);

  const { data: existing } = await supabase
    .from("investment_positions")
    .select("id, initial_balance, current_value, share_count")
    .eq("user_id", userId)
    .eq("recurring_template_id", templateId)
    .maybeSingle();

  const isCrypto = isCryptoWallet(wallet);
  const hasInstrument =
    isCrypto ||
    (row.instrument_symbol !== null && row.instrument_name !== null);
  const instrumentSymbol = isCrypto
    ? BITCOIN_INSTRUMENT.symbol
    : row.instrument_symbol;
  const instrumentName = isCrypto
    ? BITCOIN_INSTRUMENT.name
    : row.instrument_name;

  if (existing) {
    const updatePayload: {
      wallet: typeof wallet;
      name: string;
      category_id: string;
      updated_at: string;
      instrument_symbol?: string;
      instrument_name?: string;
    } = {
      wallet,
      name,
      category_id: row.category_id,
      updated_at: new Date().toISOString(),
    };

    if (hasInstrument) {
      updatePayload.instrument_symbol = instrumentSymbol!;
      updatePayload.instrument_name = instrumentName!;
    }

    await supabase
      .from("investment_positions")
      .update(updatePayload)
      .eq("id", existing.id)
      .eq("user_id", userId);

    return;
  }

  await supabase.from("investment_positions").insert({
    user_id: userId,
    wallet,
    recurring_template_id: templateId,
    name,
    category_id: row.category_id,
    initial_balance: 0,
    current_value: null,
    share_count: null,
    instrument_symbol: hasInstrument ? instrumentSymbol : null,
    instrument_name: hasInstrument ? instrumentName : null,
  });
}

export async function removeInvestmentPositionForRecurring(
  supabase: Client,
  userId: string,
  templateId: string,
): Promise<void> {
  await supabase
    .from("investment_positions")
    .delete()
    .eq("user_id", userId)
    .eq("recurring_template_id", templateId);
}

export async function syncAllRecurringInvestmentPositions(
  supabase: Client,
  userId: string,
): Promise<void> {
  const { data: templates, error } = await supabase
    .from("recurring_templates")
    .select(
      "id, categories(name, type, counts_toward_summary)",
    )
    .eq("user_id", userId);

  if (error || !templates) {
    return;
  }

  for (const template of templates) {
    const category = template.categories as RecurringTemplateWithCategory["categories"];
    if (
      category.type !== "investment" ||
      category.counts_toward_summary !== false
    ) {
      continue;
    }

    await syncInvestmentPositionFromRecurring(
      supabase,
      userId,
      template.id,
    );
  }
}

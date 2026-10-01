import { displayNameForRecurringTemplate } from "@finance/core/investment-positions";
import {
  BITCOIN_INSTRUMENT,
  isCryptoWallet,
} from "@finance/core/crypto-holdings";
import { resolveWalletId } from "@finance/core/investments";
import type { RecurringTemplateWithCategory } from "@finance/core/types/database";

import type { Db } from "./client";

function isDeploymentInvestment(
  template: RecurringTemplateWithCategory,
): boolean {
  return (
    template.categories.type === "investment" &&
    template.categories.counts_toward_summary === false
  );
}

/**
 * Keep the position a purchase-inside-a-wallet template feeds in step with
 * the template: its wallet, its name, its category and its instrument. Such
 * a template ("DCA PEA") is what grows the position, so a position that
 * named another wallet or fund than the template would be the Placements
 * screen and the charges disagreeing about the same money.
 *
 * Best-effort, like everything that follows a template save: a failure
 * leaves the position as it was and does not undo the save.
 */
export async function syncInvestmentPositionFromRecurring(
  db: Db,
  userId: string,
  templateId: string,
): Promise<void> {
  const { data: template, error } = await db
    .from("recurring_templates")
    .select("*, categories(name, type, icon, counts_toward_summary)")
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

  const { data: existing } = await db
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

    await db
      .from("investment_positions")
      .update(updatePayload)
      .eq("id", existing.id)
      .eq("user_id", userId);

    return;
  }

  await db.from("investment_positions").insert({
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
  db: Db,
  userId: string,
  templateId: string,
): Promise<void> {
  await db
    .from("investment_positions")
    .delete()
    .eq("user_id", userId)
    .eq("recurring_template_id", templateId);
}

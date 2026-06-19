import type { SupabaseClient } from "@supabase/supabase-js";
import { displayNameForRecurringTemplate } from "@/lib/investment-positions";
import { resolveWalletId } from "@/lib/investments";
import type { Database, RecurringTemplateWithCategory } from "@/lib/types/database";

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
    .select("id, initial_balance, current_value")
    .eq("user_id", userId)
    .eq("recurring_template_id", templateId)
    .maybeSingle();

  const instrumentFields =
    row.pricing_type === "shares"
      ? {
          share_count: row.share_count,
          instrument_symbol: row.instrument_symbol,
          instrument_name: row.instrument_name,
        }
      : {
          share_count: null,
          instrument_symbol: null,
          instrument_name: null,
        };

  if (existing) {
    await supabase
      .from("investment_positions")
      .update({
        wallet,
        name,
        category_id: row.category_id,
        ...instrumentFields,
        updated_at: new Date().toISOString(),
      })
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
    ...instrumentFields,
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

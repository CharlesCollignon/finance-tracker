import { redirect } from "next/navigation";
import { readFilingRules } from "@finance/data/filing-rules";
import { RulesView } from "@/components/finance/rules/RulesView";
import { getAuthUser } from "@/lib/auth/get-user";
import { getOwner } from "@/lib/owner";
import { getCategories } from "@/lib/queries/categories";
import { createClient } from "@/lib/supabase/server";

/**
 * « Règles de rangement »: the rules a person wrote for filing a line, the
 * words they decided and where they go (migration 077). The owner on
 * screen's: a joint account's lines have the space's rules.
 */
export default async function RulesPage() {
  const user = await getAuthUser();
  if (!user) {
    redirect("/login");
  }

  const ownerId = (await getOwner())?.ownerId ?? user.id;
  const [rules, categories] = await Promise.all([
    readFilingRules(await createClient(), ownerId),
    getCategories(ownerId),
  ]);

  return <RulesView rules={rules} categories={categories} />;
}

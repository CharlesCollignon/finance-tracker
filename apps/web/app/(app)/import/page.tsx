import { redirect } from "next/navigation";
import {
  readFileAccounts,
  readStatementImports,
} from "@finance/data/statements";
import { getAuthUser } from "@/lib/auth/get-user";
import { getOwner } from "@/lib/owner";
import { createClient } from "@/lib/supabase/server";
import { StatementImport } from "@/components/finance/statements/StatementImport";

export const metadata = {
  title: "Import",
};

/**
 * Importing a bank statement (`StatementImport`): the accounts already known
 * from earlier files, so the next one goes to its own without a question,
 * and the latest imports, each to be undone for a month.
 */
export default async function ImportPage() {
  const user = await getAuthUser();

  if (!user) {
    redirect("/login");
  }

  const ownerId = (await getOwner())?.ownerId ?? user.id;
  const db = await createClient();
  const [accounts, imports] = await Promise.all([
    readFileAccounts(db, user.id),
    readStatementImports(db, ownerId),
  ]);

  return <StatementImport accounts={accounts} imports={imports} />;
}

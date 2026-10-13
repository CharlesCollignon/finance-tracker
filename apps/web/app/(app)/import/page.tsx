import { redirect } from "next/navigation";
import {
  readFileAccounts,
  readStatementImports,
} from "@finance/data/statements";
import { writerStateFor } from "@/lib/ai/writer";
import { getAuthUser } from "@/lib/auth/get-user";
import { getOwner } from "@/lib/owner";
import { inboxView } from "@/lib/statements/inbox";
import { createClient } from "@/lib/supabase/server";
import { StatementImport } from "@/components/finance/statements/StatementImport";

export const metadata = {
  title: "Import",
};

/** A scan read by the person's AI account takes its time (`lib/statements/scan.ts`). */
export const maxDuration = 60;

/**
 * Importing a bank statement (`StatementImport`): the accounts already known
 * from earlier files, so the next one goes to its own without a question,
 * the latest imports, each to be undone for a month, whether an AI
 * account is there to read a picture, and the person's address for their
 * bank's e-mails with what waits from it.
 */
export default async function ImportPage() {
  const user = await getAuthUser();

  if (!user) {
    redirect("/login");
  }

  const ownerId = (await getOwner())?.ownerId ?? user.id;
  const db = await createClient();
  const [accounts, imports, writer, mail] = await Promise.all([
    readFileAccounts(db, user.id),
    readStatementImports(db, ownerId),
    writerStateFor(user.id, db),
    inboxView(db, user.id),
  ]);

  return (
    <StatementImport
      accounts={accounts}
      imports={imports}
      aiAccount={writer.account}
      mail={mail}
    />
  );
}

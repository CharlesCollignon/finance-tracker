import { redirect } from "next/navigation";
import { consentIsCurrent } from "@finance/core/bank-consent";
import { getAuthUser } from "@/lib/auth/get-user";
import { bankFeedStatus } from "@/lib/bank/client";
import { bankSetupOffered } from "@/lib/bank/offer";
import { getBankAccounts } from "@/lib/queries/bank-balance";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/layout/PageHeader";
import { PageContainer } from "@/components/layout/PageContainer";
import { BankView } from "@/components/finance/bank/BankView";

interface BankPageProps {
  /** `?setup=1` opens the upload straight away — where the phone sends people. */
  searchParams: Promise<{ setup?: string }>;
}

/**
 * The bank connection: where every "Connect your bank" leads, where the
 * credentials file is dropped, and where it is looked after afterwards.
 *
 * The connection row is read with the user's own session — the one table of
 * the three this user may read — so nothing here ever touches the secrets.
 */
export default async function BankPage({ searchParams }: BankPageProps) {
  const user = await getAuthUser();
  if (!user) {
    redirect("/login");
  }

  const supabase = await createClient();
  const [{ data: row }, accounts, status, params, offered] = await Promise.all([
    supabase
      .from("bank_connections")
      .select(
        "status, last_synced_at, consent_valid_until, backfilled_at, consent_version",
      )
      .eq("user_id", user.id)
      .maybeSingle(),
    getBankAccounts(user.id),
    bankFeedStatus(user.id),
    searchParams,
    bankSetupOffered(),
  ]);

  const connection = row
    ? {
        status: row.status,
        lastSyncedAt: row.last_synced_at,
        consentValidUntil: row.consent_valid_until,
        backfilled: row.backfilled_at !== null,
        consentCurrent: consentIsCurrent(row.consent_version),
      }
    : null;

  return (
    <>
      <PageHeader titleKey="pages.bank" />
      <PageContainer className="mx-auto w-full max-w-3xl">
        <BankView
          available={offered}
          connection={connection}
          // Syncing with no row of its own: the owner still on the
          // deployment's environment bundle, until they upload their own.
          ownerCredentials={!row && status === "connected"}
          accounts={accounts}
          startWithSetup={offered && params.setup === "1"}
        />
      </PageContainer>
    </>
  );
}

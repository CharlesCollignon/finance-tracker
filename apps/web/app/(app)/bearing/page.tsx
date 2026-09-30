import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getAuthUser } from "@/lib/auth/get-user";
import { gatherBearingMonth } from "@/lib/bearing/month";
import { readBankAttention } from "@/lib/bank/attention";
import { shouldInviteToConnect } from "@/lib/bank/invite";
import { getCurrentMonth, parseMonthParams } from "@finance/core/constants";
import { PageHeader } from "@/components/layout/PageHeader";
import { PageContainer } from "@/components/layout/PageContainer";
import { BearingMonthView } from "@/components/finance/bearing/BearingMonthView";
import { MonthReadSlot } from "@/components/finance/bearing/MonthReadSlot";

interface BearingPageProps {
  searchParams: Promise<{ y?: string; m?: string }>;
}

/**
 * The Bearing: what is on the account, where the month ends, and what it
 * went on — one month at a time.
 *
 * It opens on the month in progress, always: it is the landing page, and a
 * landing page that opened on whatever month was last browsed would answer
 * last March's question on the first of October. Another month is one press
 * of the same switcher the Ledger has, and lives in the address. Everything
 * is gathered in one pass and drawn on the client, because the display
 * currency is this browser's and no server can know it.
 */
export default async function BearingPage({ searchParams }: BearingPageProps) {
  const user = await getAuthUser();

  if (!user) {
    redirect("/login");
  }

  const params = await searchParams;
  const { year, month } =
    params.y && params.m
      ? parseMonthParams(params.y, params.m)
      : getCurrentMonth();
  const [data, bankInvite, bankAttention] = await Promise.all([
    gatherBearingMonth(user.id, year, month),
    shouldInviteToConnect(user.id, "bearing"),
    readBankAttention(user.id),
  ]);

  return (
    <>
      <PageHeader titleKey="nav.bearing" />
      <PageContainer>
        <BearingMonthView
          data={data}
          bankInvite={bankInvite}
          bankAttention={bankAttention}
          // A month ahead has nothing to read yet: nothing has happened in it.
          readSlot={
            data.balance.period === "future" ? null : (
              <Suspense fallback={null}>
                <MonthReadSlot userId={user.id} year={year} month={month} />
              </Suspense>
            )
          }
        />
      </PageContainer>
    </>
  );
}

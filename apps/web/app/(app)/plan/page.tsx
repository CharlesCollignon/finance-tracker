import { redirect } from "next/navigation";
import { getAuthUser } from "@/lib/auth/get-user";
import { shouldInviteToConnect } from "@/lib/bank/invite";
import { gatherPlanBase, gatherPlanWealth } from "@/lib/queries/plan";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { PlanView } from "@/components/finance/plan/PlanView";

/**
 * Plan: where the money is heading — a year from now, the milestones on the
 * way, the long view after French tax — and the run of month-ends that keeps
 * it honest.
 *
 * Two loads. The ledger's half is awaited and drawn at once; the investment
 * accounts' market value is handed down as a promise, unawaited, so the
 * milestones and the long view stream in behind it without holding the year
 * ahead back. Drawn on the client, because the display currency is this
 * browser's, the long view remembers the reader's edits here, and every
 * figure on it answers a slider.
 */
export default async function PlanPage() {
  const user = await getAuthUser();

  if (!user) {
    redirect("/login");
  }

  const wealth = gatherPlanWealth(user.id);
  const [base, bankInvite] = await Promise.all([
    gatherPlanBase(user.id),
    shouldInviteToConnect(user.id, "plan"),
  ]);

  return (
    <>
      <PageHeader titleKey="nav.plan" />
      <PageContainer>
        <PlanView base={base} wealth={wealth} bankInvite={bankInvite} />
      </PageContainer>
    </>
  );
}

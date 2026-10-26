import { redirect } from "next/navigation";
import { getAuthUser } from "@/lib/auth/get-user";
import { shouldInviteToConnect } from "@/lib/bank/invite";
import { gatherPlanBase, gatherPlanWealth } from "@/lib/queries/plan";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { PlanView } from "@/components/finance/plan/PlanView";

/**
 * Plan: where the money could go, replayed on what markets actually did
 * since 1970 — the trajectory, history's falls, the milestones and the run.
 *
 * Two loads. The ledger's half is awaited; the investment accounts' market
 * value is handed down as a promise, unawaited, and the cards are drawn once
 * it lands, because every one of them counts the investments. Drawn on the
 * client, because the display currency is this browser's, « Hypothèses »
 * remembers the reader's edits here, and every figure answers a slider.
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

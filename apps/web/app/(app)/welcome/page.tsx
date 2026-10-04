import { redirect } from "next/navigation";
import { getAuthUser } from "@/lib/auth/get-user";
import { getCategories } from "@/lib/queries/categories";
import { WelcomeFlow } from "@/components/onboarding/WelcomeFlow";
import { shouldInviteToConnect } from "@/lib/bank/invite";
import { getFlags } from "@/lib/flags";
import { createClient } from "@/lib/supabase/server";
import { isFlagOn } from "@finance/core/flags";
import type { AiConnectOutcome } from "@/components/profile/AiAccountSection";

const AI_OUTCOMES: readonly AiConnectOutcome[] = [
  "connected",
  "refused",
  "expired",
];

interface WelcomePageProps {
  /** `?ai=` is where OpenRouter's callback lands a trip begun here. */
  searchParams: Promise<{ ai?: string }>;
}

export const metadata = {
  title: "Welcome",
};

export default async function WelcomePage({ searchParams }: WelcomePageProps) {
  const user = await getAuthUser();

  if (!user) {
    redirect("/login");
  }

  // Defaults are seeded at sign-up, so there is something to choose from here.
  const supabase = await createClient();
  const [categories, offerBank, flags, params, { data: bank }] =
    await Promise.all([
      getCategories(user.id),
      shouldInviteToConnect(user.id, "welcome"),
      getFlags(),
      searchParams,
      supabase
        .from("bank_connections")
        .select("backfilled_at")
        .eq("user_id", user.id)
        .maybeSingle(),
    ]);

  return (
    <WelcomeFlow
      categories={categories.filter((c) => !c.archived)}
      offerBank={offerBank}
      offerAi={isFlagOn(flags, "ai.account")}
      aiOutcome={AI_OUTCOMES.find((outcome) => outcome === params.ai) ?? null}
      // Connected at the bank step and still to bring its history in.
      bankWaiting={bank !== null && bank.backfilled_at === null}
    />
  );
}

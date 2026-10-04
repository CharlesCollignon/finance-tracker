import { redirect } from "next/navigation";
import { getAuthUser } from "@/lib/auth/get-user";
import { ProfileView } from "@/components/profile/ProfileView";
import { bankFeedStatus } from "@/lib/bank/client";
import { bankSetupOffered } from "@/lib/bank/offer";
import { type PasskeyItem } from "@/components/profile/PasskeysPanel";
import { createClient } from "@/lib/supabase/server";
import { getNotificationSettings } from "@finance/data/preferences";
import { getAiConnection } from "@finance/data/ai-connection";
import { isFlagOn } from "@finance/core/flags";
import { getFlags } from "@/lib/flags";
import type { AiConnectOutcome } from "@/components/profile/AiAccountSection";

const AI_OUTCOMES: readonly AiConnectOutcome[] = [
  "connected",
  "refused",
  "expired",
];

interface ProfilePageProps {
  /** `?ai=` is where the OpenRouter callback sends the user back with. */
  searchParams: Promise<{ ai?: string }>;
}

function getProviderLabel(provider: string | undefined): string {
  if (!provider) {
    return "email";
  }
  if (provider === "google") {
    return "Google";
  }
  return provider;
}

export default async function ProfilePage({ searchParams }: ProfilePageProps) {
  const user = await getAuthUser();

  if (!user) {
    redirect("/login");
  }

  const fullName =
    (user.user_metadata?.full_name as string | undefined) ??
    (user.user_metadata?.name as string | undefined) ??
    "";
  const provider = getProviderLabel(
    user.app_metadata?.provider as string | undefined,
  );
  const canDeleteAccount = Boolean(
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim(),
  );

  // The Bank row only where it leads somewhere: setup is open to this
  // account, or a bank already syncs for it.
  const [offered, bankStatus, notifications, flags, params] = await Promise.all(
    [
      bankSetupOffered(),
      bankFeedStatus(user.id),
      // Every kind on is what a missing row means, and what a failed read
      // shows.
      getNotificationSettings(await createClient(), user.id).catch(() => null),
      getFlags(),
      searchParams,
    ],
  );

  const aiAccount = isFlagOn(flags, "ai.account")
    ? {
        model: await getAiConnection(await createClient(), user.id),
        outcome: AI_OUTCOMES.find((outcome) => outcome === params.ai) ?? null,
      }
    : null;

  let initialPasskeys: PasskeyItem[] = [];
  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.passkey.list();
    initialPasskeys = data ?? [];
  } catch {
    initialPasskeys = [];
  }

  return (
    <ProfileView
      email={user.email ?? ""}
      fullName={fullName}
      provider={provider}
      canDeleteAccount={canDeleteAccount}
      initialPasskeys={initialPasskeys}
      pushPublicKey={process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ""}
      notificationPrefs={notifications?.prefs ?? {}}
      showBank={offered || bankStatus !== "unconfigured"}
      showProperty={isFlagOn(flags, "property.track")}
      aiAccount={aiAccount}
    />
  );
}

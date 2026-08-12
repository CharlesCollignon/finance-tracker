import { redirect } from "next/navigation";
import { getAuthUser } from "@/lib/auth/get-user";
import { ProfileView } from "@/components/profile/ProfileView";

function getProviderLabel(provider: string | undefined): string {
  if (!provider) {
    return "email";
  }
  if (provider === "google") {
    return "Google";
  }
  return provider;
}

export default async function ProfilePage() {
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

  return (
    <ProfileView
      email={user.email ?? ""}
      fullName={fullName}
      provider={provider}
      canDeleteAccount={canDeleteAccount}
    />
  );
}

import { getMySpace, peekSpaceInvite } from "@finance/data/spaces";
import { JoinSpaceCard } from "@/components/space/JoinSpaceCard";
import { getAuthUser } from "@/lib/auth/get-user";
import { createClient } from "@/lib/supabase/server";

/**
 * Where an invite to a shared space lands (`/join/<token>`).
 *
 * Signed out, it says what it is and sends to sign in or sign up; the proxy
 * keeps the token and brings them back here afterwards. Signed in, it reads
 * the link — who sent it, which space, whether it still works — before
 * anything is joined: joining is the button's, never the visit's.
 */
export default async function JoinPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const user = await getAuthUser();
  if (!user) {
    return <JoinSpaceCard state={{ kind: "signedOut" }} token={token} />;
  }

  const db = await createClient();
  const [invite, mine] = await Promise.all([
    peekSpaceInvite(db, token).catch(() => null),
    getMySpace(db, user.id).catch(() => null),
  ]);
  const self =
    (user.user_metadata?.full_name as string | undefined) ??
    (user.user_metadata?.name as string | undefined) ??
    user.email ??
    "";

  if (mine) {
    return (
      <JoinSpaceCard
        state={{
          kind: invite?.spaceId === mine.id ? "here" : "elsewhere",
          spaceName: mine.name,
        }}
        token={token}
      />
    );
  }
  if (!invite?.usable) {
    return <JoinSpaceCard state={{ kind: "unusable" }} token={token} />;
  }
  return (
    <JoinSpaceCard
      state={{
        kind: "open",
        spaceName: invite.spaceName,
        invitedBy: invite.invitedBy,
        self,
      }}
      token={token}
    />
  );
}

import { getAuthUser } from "@/lib/auth/get-user";
import { NewPasswordForm } from "@/components/auth/NewPasswordForm";

/**
 * Choosing a new password, after a reset link signed the reader in.
 *
 * Without a session there is nothing to change, so the form explains where
 * this page is opened from instead of failing on submit.
 */
export default async function NewPasswordPage() {
  const user = await getAuthUser();
  return <NewPasswordForm signedIn={user !== null} />;
}

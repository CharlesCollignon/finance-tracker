import { useState } from "react";

import { AuthForm } from "@/components/auth/AuthForm";
import { CheckInbox } from "@/components/auth/CheckInbox";
import { useAuth } from "@/providers/AuthProvider";
import { useLocale, useT } from "@/providers/LocaleProvider";

export default function SignupScreen() {
  const t = useT();
  const locale = useLocale();
  const { signUp } = useAuth();
  // The address the confirmation went to, while the account waits for it.
  const [sentTo, setSentTo] = useState<string | null>(null);
  // Kept after « La modifier », so the form comes back with it typed in.
  const [lastEmail, setLastEmail] = useState("");

  async function submit(email: string, password: string) {
    const result = await signUp(email, password, locale);
    if (result.confirmEmail) {
      setLastEmail(email);
      setSentTo(email);
      return {};
    }
    return result;
  }

  if (sentTo) {
    return (
      <CheckInbox email={sentTo} onChangeAddress={() => setSentTo(null)} />
    );
  }

  return (
    <AuthForm
      title={t("auth.createAccount")}
      submitLabel={t("auth.createAccount")}
      onSubmit={submit}
      newPassword
      initialEmail={lastEmail}
      footerPrompt={t("auth.haveAccount")}
      footerLinkLabel={t("auth.signIn")}
      footerHref="/login"
    />
  );
}

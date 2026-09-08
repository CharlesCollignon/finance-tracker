import { AuthForm } from "@/components/auth/AuthForm";
import { useAuth } from "@/providers/AuthProvider";
import { useT } from "@/providers/LocaleProvider";

export default function SignupScreen() {
  const t = useT();
  const { signUp } = useAuth();

  return (
    <AuthForm
      title={t("auth.createAccount")}
      submitLabel={t("auth.createAccount")}
      onSubmit={signUp}
      newPassword
      footerPrompt={t("auth.haveAccount")}
      footerLinkLabel={t("auth.signIn")}
      footerHref="/login"
    />
  );
}

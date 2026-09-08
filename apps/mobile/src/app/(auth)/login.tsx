import { AuthForm } from "@/components/auth/AuthForm";
import { useAuth } from "@/providers/AuthProvider";
import { useT } from "@/providers/LocaleProvider";

export default function LoginScreen() {
  const t = useT();
  const { signIn } = useAuth();

  return (
    <AuthForm
      title={t("auth.signIn")}
      submitLabel={t("auth.signIn")}
      onSubmit={signIn}
      showPasskey
      footerPrompt={t("auth.noAccountYet")}
      footerLinkLabel={t("auth.createOne")}
      footerHref="/signup"
    />
  );
}

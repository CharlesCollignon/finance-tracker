import { AuthForm } from "@/components/auth/AuthForm";
import { useAuth } from "@/providers/AuthProvider";

export default function LoginScreen() {
  const { signIn } = useAuth();

  return (
    <AuthForm
      title="Sign in"
      submitLabel="Sign in"
      onSubmit={signIn}
      footerPrompt="No account yet?"
      footerLinkLabel="Create one"
      footerHref="/signup"
    />
  );
}

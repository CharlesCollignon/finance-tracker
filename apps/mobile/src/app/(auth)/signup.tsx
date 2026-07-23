import { AuthForm } from "@/components/auth/AuthForm";
import { useAuth } from "@/providers/AuthProvider";

export default function SignupScreen() {
  const { signUp } = useAuth();

  return (
    <AuthForm
      title="Create account"
      submitLabel="Create account"
      onSubmit={signUp}
      footerPrompt="Already have an account?"
      footerLinkLabel="Sign in"
      footerHref="/login"
    />
  );
}

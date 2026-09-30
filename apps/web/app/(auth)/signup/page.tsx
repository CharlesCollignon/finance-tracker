import { SignupForm } from "@/components/auth/SignupForm";
import { legalPagesVisible } from "@/components/marketing/legal-status";

export default function SignupPage() {
  return <SignupForm legalLinks={legalPagesVisible()} />;
}

import { Suspense } from "react";
import { ResetPasswordForm } from "@/components/auth/ResetPasswordForm";

export default function ResetPage() {
  return (
    <Suspense>
      <ResetPasswordForm />
    </Suspense>
  );
}

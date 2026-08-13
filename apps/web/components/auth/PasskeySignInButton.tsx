"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Fingerprint } from "@phosphor-icons/react";
import { Button } from "@/components/retroui/Button";
import { Text } from "@/components/retroui/Text";
import { seedCategoriesForCurrentUser } from "@/lib/actions/finance";
import { createClient } from "@/lib/supabase/client";

interface PasskeySignInButtonProps {
  label?: string;
}

export function PasskeySignInButton({
  label = "Sign in with passkey",
}: PasskeySignInButtonProps) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handlePasskeySignIn() {
    setPending(true);
    setError(null);

    const supabase = createClient();
    const { data, error: passkeyError } =
      await supabase.auth.signInWithPasskey();

    if (passkeyError) {
      setError(passkeyError.message);
      setPending(false);
      return;
    }

    if (data.user) {
      await seedCategoriesForCurrentUser();
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-2">
      <Button
        type="button"
        variant="outline"
        size="lg"
        className="w-full gap-2"
        onClick={() => {
          void handlePasskeySignIn();
        }}
        disabled={pending}
      >
        <Fingerprint size={20} weight="bold" />
        {pending ? "Waiting for passkey…" : label}
      </Button>
      {error && <Text className="text-sm text-destructive">{error}</Text>}
    </div>
  );
}

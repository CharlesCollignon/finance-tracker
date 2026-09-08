"use client";

import { useState } from "react";
import { GoogleLogo } from "@phosphor-icons/react";
import { Button } from "@/components/retroui/Button";
import { Text } from "@/components/retroui/Text";
import { createClient } from "@/lib/supabase/client";
import { ICON } from "@/lib/icon-scale";
import { resolveMessage } from "@finance/core/i18n/t";
import { useT } from "@/lib/locale-context";

interface GoogleSignInButtonProps {
  label?: string;
}

export function GoogleSignInButton({
  label = "Continue with Google",
}: GoogleSignInButtonProps) {
  const t = useT();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGoogleSignIn() {
    setPending(true);
    setError(null);

    const supabase = createClient();
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (oauthError) {
      setError(oauthError.message);
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <Button
        type="button"
        variant="outline"
        size="lg"
        className="w-full gap-2"
        onClick={handleGoogleSignIn}
        disabled={pending}
      >
        <GoogleLogo size={ICON.xl} weight="bold" />
        {pending ? "Redirecting…" : label}
      </Button>
      {error && (
        <Text className="text-sm text-destructive">
          {resolveMessage(t, error)}
        </Text>
      )}
    </div>
  );
}

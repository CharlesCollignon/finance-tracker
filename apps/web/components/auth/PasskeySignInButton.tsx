"use client";

import { useState } from "react";
import { Fingerprint } from "@phosphor-icons/react";
import { Button } from "@/components/ui/Button";
import { Text } from "@/components/ui/Text";
import { seedCategoriesForCurrentUser } from "@/lib/actions/finance";
import { createClient } from "@/lib/supabase/client";
import { ICON } from "@/lib/icon-scale";
import { resolveMessage } from "@finance/core/i18n/t";
import { useT } from "@/lib/locale-context";

interface PasskeySignInButtonProps {
  label?: string;
}

export function PasskeySignInButton({ label }: PasskeySignInButtonProps) {
  const t = useT();
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

    // A full page load, not `router.push` + `router.refresh` as the password
    // form does. The seed call above resolves before Next's router has
    // finished with it, so a push here preempts that action and the refresh
    // is queued behind the preempted one — it never runs, and the screen
    // stays on the login page until the reader reloads it. A page load also
    // lets the server render the Bearing with the session the browser has
    // just stored.
    window.location.assign("/bearing");
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
        <Fingerprint size={ICON.xl} weight="bold" />
        {pending
          ? t("auth.waitingForPasskey")
          : (label ?? t("auth.withPasskey"))}
      </Button>
      {error && (
        <Text className="text-sm text-destructive">
          {resolveMessage(t, error)}
        </Text>
      )}
    </div>
  );
}

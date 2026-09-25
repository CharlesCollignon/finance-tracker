"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowRight } from "@phosphor-icons/react";
import { Button, ButtonNub } from "@/components/retroui/Button";
import { Card } from "@/components/retroui/Card";
import { Input } from "@/components/retroui/Input";
import { FormLabel } from "@/components/layout/FormLabel";
import { Text } from "@/components/retroui/Text";
import { createClient } from "@/lib/supabase/client";
import { ICON } from "@/lib/icon-scale";
import { useT } from "@/lib/locale-context";
import { resolveMessage } from "@finance/core/i18n/t";

/**
 * Asking for a way back in.
 *
 * There was no route to this at all. Email and password is a first-class way
 * into the app — `signIn` is the form the login page leads with — so somebody
 * who forgot theirs and had never added a passkey or used Google was locked
 * out of their own ledger permanently, with nothing on any screen to press.
 *
 * Client-side rather than a server action, which is the pattern the two
 * sibling buttons on the login page already use: `GoogleSignInButton` and
 * `PasskeySignInButton` both reach for `createClient()` and call
 * `supabase.auth` directly, because the redirect has to be built from the
 * origin the reader is actually on.
 *
 * The confirmation is the same whether or not the address has an account
 * behind it, and that is the point rather than an oversight: a form that
 * says "no account with that email" tells anybody who asks which addresses
 * are registered here. Supabase answers the same way for the same reason.
 */
export function ResetPasswordForm() {
  const t = useT();
  const expired = useSearchParams().get("error") === "link_expired";
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function requestReset(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);

    const supabase = createClient();
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(
      email,
      // The confirm route (token hash) is where the email template sends
      // people; until the template changes, the callback forwards to the same
      // new-password page when the link is opened in this browser.
      { redirectTo: `${window.location.origin}/auth/callback?next=/reset/new` },
    );

    setPending(false);

    if (resetError) {
      setError(resetError.message);
      return;
    }

    setSent(true);
  }

  return (
    <Card.Bezel
      className="w-full max-w-md md:max-w-lg"
      innerClassName="p-6 md:p-8"
    >
      {/* `font-head`, not the `font-serif ... italic` its two siblings use.
          DESIGN.md is explicit that Fraunces is for figures and that a serif
          heading is not in this system, so this screen does not copy the
          neighbours it was modelled on. The other two are a known deviation
          that predates this file. */}
      <h1 className="text-center font-head text-2xl md:text-3xl">
        {t("auth.resetHeading")}
      </h1>
      <p className="mt-1 text-center text-sm text-muted-foreground">
        {t("auth.resetBody")}
      </p>

      {expired && !sent ? (
        <Text
          role="alert"
          className="mt-4 text-center text-sm text-destructive"
        >
          {t("auth.resetLinkExpired")}
        </Text>
      ) : null}

      {sent ? (
        // The form is replaced rather than disabled: there is nothing left to
        // do on this screen, and a filled-in field above a greyed button
        // invites a second press that would only send a second mail.
        <Text className="mt-6 text-center text-sm text-muted-foreground">
          {t("auth.resetSent", { email })}
        </Text>
      ) : (
        <form onSubmit={requestReset} className="mt-6 flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <FormLabel htmlFor="reset-email">{t("auth.email")}</FormLabel>
            <Input
              id="reset-email"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="text-base"
            />
          </div>
          {error ? (
            <Text className="text-center text-sm text-destructive">
              {resolveMessage(t, error)}
            </Text>
          ) : null}
          <Button
            type="submit"
            variant="pill"
            size="lg"
            className="w-full justify-between"
            disabled={pending}
          >
            {pending ? t("auth.sendingResetLink") : t("auth.sendResetLink")}
            <ButtonNub>
              <ArrowRight size={ICON.md} weight="bold" />
            </ButtonNub>
          </Button>
        </form>
      )}

      <p className="mt-4 text-center text-sm text-muted-foreground">
        <Link href="/login" className="font-medium underline">
          {t("auth.backToSignIn")}
        </Link>
      </p>
    </Card.Bezel>
  );
}

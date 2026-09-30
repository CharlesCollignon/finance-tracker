"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight } from "@phosphor-icons/react";
import { Button, ButtonNub } from "@/components/retroui/Button";
import { Card } from "@/components/retroui/Card";
import { Input } from "@/components/retroui/Input";
import { FormLabel } from "@/components/layout/FormLabel";
import { Text } from "@/components/retroui/Text";
import { signUp } from "@/lib/actions/finance";
import { GoogleSignInButton } from "@/components/auth/GoogleSignInButton";
import { AuthDivider } from "@/components/auth/AuthDivider";
import { ICON } from "@/lib/icon-scale";
import { useT } from "@/lib/locale-context";
import { resolveMessage } from "@finance/core/i18n/t";

/**
 * The acceptance line, with its two document names as links.
 *
 * The sentence stays whole in each catalogue, so a language can put the two
 * names wherever its grammar wants them; the names are filled with markers
 * and the markers swapped for links here. Control characters, because no
 * sentence contains one — built from their codes rather than written as
 * escapes, which the catalogue's unused-key scan cannot read past.
 */
const TERMS_MARK = String.fromCharCode(1);
const PRIVACY_MARK = String.fromCharCode(2);
const MARKS = new RegExp(`(${TERMS_MARK}|${PRIVACY_MARK})`);
const LEGAL_LINK = "underline underline-offset-2 hover:text-foreground";

function LegalConsent() {
  const t = useT();
  const sentence = t("auth.legalConsent", {
    terms: TERMS_MARK,
    privacy: PRIVACY_MARK,
  });
  return (
    <p className="mt-4 text-center text-xs leading-relaxed text-muted-foreground">
      {sentence.split(MARKS).map((part, index) =>
        part === TERMS_MARK ? (
          <Link key={index} href="/terms" className={LEGAL_LINK}>
            {t("auth.termsLink")}
          </Link>
        ) : part === PRIVACY_MARK ? (
          <Link key={index} href="/privacy" className={LEGAL_LINK}>
            {t("auth.privacyLink")}
          </Link>
        ) : (
          part
        ),
      )}
    </p>
  );
}

export function SignupForm({
  legalLinks = false,
}: {
  /** Whether the privacy policy and terms may be linked on this deployment. */
  legalLinks?: boolean;
}) {
  const t = useT();
  const router = useRouter();
  const [state, action, pending] = useActionState(signUp, {});

  useEffect(() => {
    if (state.success && !state.message) {
      // New accounts go through setup first, so the dashboard has real
      // numbers in it rather than a screen of zeros.
      router.push("/welcome");
      router.refresh();
    }
  }, [state.success, state.message, router]);

  return (
    <Card.Bezel
      className="w-full max-w-md md:max-w-lg"
      innerClassName="p-6 md:p-8"
    >
      <h1 className="text-center font-serif text-2xl italic md:text-3xl">
        {t("auth.createAccount")}
      </h1>
      <p className="mt-1 text-center text-sm text-muted-foreground">
        {t("auth.signUpHeading")}
      </p>
      <div className="mt-6">
        <GoogleSignInButton label={t("auth.withGoogleSignUp")} />
      </div>
      <AuthDivider />
      <form action={action} className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <FormLabel htmlFor="email">{t("auth.email")}</FormLabel>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            className="text-base"
          />
        </div>
        <div className="flex flex-col gap-2">
          <FormLabel htmlFor="password">{t("auth.password")}</FormLabel>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={6}
            className="text-base"
          />
        </div>
        {state.error && (
          <Text className="text-center text-sm text-destructive">
            {resolveMessage(t, state.error)}
          </Text>
        )}
        {state.message && (
          <Text className="text-center text-sm text-muted-foreground">
            {state.message}
          </Text>
        )}
        <Button
          type="submit"
          variant="pill"
          size="lg"
          className="w-full justify-between px-2"
          disabled={pending}
        >
          {pending ? t("auth.creating") : t("auth.signUp")}
          <ButtonNub balanced>
            <ArrowRight size={ICON.md} weight="bold" />
          </ButtonNub>
        </Button>
      </form>
      {legalLinks ? <LegalConsent /> : null}
      <p className="mt-4 text-center text-sm text-muted-foreground">
        {t("auth.haveAccount")}{" "}
        <Link href="/login" className="font-medium underline">
          {t("auth.signIn")}
        </Link>
      </p>
    </Card.Bezel>
  );
}

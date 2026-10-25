"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  AnimatePresence,
  LazyMotion,
  MotionConfig,
  domAnimation,
  m,
} from "motion/react";
import { ArrowRight, CheckCircle } from "@phosphor-icons/react";
import { Button, ButtonNub } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { FormLabel } from "@/components/ui/FormLabel";
import { Text } from "@/components/ui/Text";
import { signUp, type SignUpOutcome } from "@/lib/actions/finance";
import { GoogleSignInButton } from "@/components/auth/GoogleSignInButton";
import { AuthDivider } from "@/components/auth/AuthDivider";
import { CheckInbox } from "@/components/auth/CheckInbox";
import { FADE } from "@/components/motion/fade";
import { ICON } from "@/lib/icon-scale";
import { useT } from "@/lib/locale-context";
import { resolveMessage } from "@finance/core/i18n/t";
import type { FormState } from "@finance/core/action-result";

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
  const [state, action, pending] = useActionState<
    FormState<SignUpOutcome>,
    FormData
  >(signUp, {});
  // Controlled, so « La modifier » brings back what was typed rather than an
  // empty form.
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [editing, setEditing] = useState(false);

  const waiting = state.success && state.confirmEmail && !editing;
  // The tick beside « Confirmez » only once the pair would be accepted.
  const matching = password.length >= 6 && confirm === password;

  function submit(formData: FormData) {
    setEditing(false);
    action(formData);
  }

  useEffect(() => {
    if (state.success && !state.confirmEmail) {
      // New accounts go through setup first, so the dashboard has real
      // numbers in it rather than a screen of zeros.
      router.push("/welcome");
      router.refresh();
    }
  }, [state, router]);

  return (
    <LazyMotion features={domAnimation} strict>
      <MotionConfig reducedMotion="user">
        <Card.Bezel
          className="w-full max-w-md md:max-w-lg"
          innerClassName="p-6 md:p-8"
        >
          <AnimatePresence mode="wait" initial={false}>
            {waiting ? (
              <m.div key="inbox" {...FADE}>
                <CheckInbox
                  email={email}
                  onChangeAddress={() => setEditing(true)}
                />
              </m.div>
            ) : (
              <m.div key="form" {...FADE}>
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
                <form action={submit} className="flex flex-col gap-4">
                  <div className="flex flex-col gap-2">
                    <FormLabel htmlFor="email">{t("auth.email")}</FormLabel>
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      autoComplete="email"
                      required
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      className="text-base"
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <FormLabel htmlFor="password">
                      {t("auth.password")}
                    </FormLabel>
                    <Input
                      id="password"
                      name="password"
                      type="password"
                      autoComplete="new-password"
                      required
                      minLength={6}
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      className="text-base"
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <FormLabel htmlFor="confirm">
                        {t("auth.confirmPassword")}
                      </FormLabel>
                      <AnimatePresence>
                        {matching ? (
                          <m.span
                            key="match"
                            {...FADE}
                            className="text-primary"
                          >
                            <CheckCircle
                              size={ICON.lg}
                              weight="fill"
                              aria-hidden
                            />
                          </m.span>
                        ) : null}
                      </AnimatePresence>
                    </div>
                    <Input
                      id="confirm"
                      name="confirm"
                      type="password"
                      autoComplete="new-password"
                      required
                      value={confirm}
                      onChange={(event) => setConfirm(event.target.value)}
                      className="text-base"
                    />
                  </div>
                  {state.error && !pending ? (
                    <Text
                      role="alert"
                      className="text-center text-sm text-destructive"
                    >
                      {resolveMessage(t, state.error)}
                    </Text>
                  ) : null}
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
              </m.div>
            )}
          </AnimatePresence>
        </Card.Bezel>
      </MotionConfig>
    </LazyMotion>
  );
}

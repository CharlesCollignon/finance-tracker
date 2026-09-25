"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight } from "@phosphor-icons/react";
import { Button, ButtonNub } from "@/components/retroui/Button";
import { Card } from "@/components/retroui/Card";
import { Input } from "@/components/retroui/Input";
import { FormLabel } from "@/components/layout/FormLabel";
import { Text } from "@/components/retroui/Text";
import { createClient } from "@/lib/supabase/client";
import { ICON } from "@/lib/icon-scale";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/locale-context";
import { resolveMessage } from "@finance/core/i18n/t";
import { newPasswordSchema } from "@finance/core/validations/finance";
import { newPasswordErrorKey } from "@/lib/auth/new-password-error";

/** Ties the alert to the field it concerns, and the field to the alert. */
const ERROR_ID = "new-password-error";

export function NewPasswordForm({ signedIn }: { signedIn: boolean }) {
  const t = useT();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /**
   * Bumped on every failed submit and used as the alert's `key`, so a second
   * failure with the identical message is a fresh DOM node rather than an
   * unchanged one — screen readers announce role="alert" on insertion, not
   * on a text node mutating underneath an element they already read.
   */
  const [attempt, setAttempt] = useState(0);
  const [changed, setChanged] = useState(false);

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const parsed = newPasswordSchema.safeParse({ password, confirm });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "errors.invalidInput");
      setAttempt((count) => count + 1);
      return;
    }

    setPending(true);
    const { error: updateError } = await createClient().auth.updateUser({
      password: parsed.data.password,
    });
    setPending(false);

    if (updateError) {
      setError(newPasswordErrorKey(updateError.code));
      setAttempt((count) => count + 1);
      return;
    }
    setChanged(true);
    // The form — including the focused submit button — is about to unmount
    // in this same render, which would otherwise drop focus to <body>. The
    // heading is the one element present in every state, so it is where
    // focus lands; done here, right after the state that causes the
    // unmount, rather than in an effect that would run one render late.
    headingRef.current?.focus();
  }

  const confirmHasError = error === "errors.passwordsDiffer";
  const passwordHasError = Boolean(error) && !confirmHasError;

  return (
    <Card.Bezel
      className="w-full max-w-md md:max-w-lg"
      innerClassName="p-6 md:p-8"
    >
      <h1
        ref={headingRef}
        tabIndex={-1}
        className="text-center font-head text-2xl md:text-3xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        {t("auth.newPasswordHeading")}
      </h1>

      {/*
        Mounted in every state, empty until success, rather than created
        together with its text only once `changed` is true — a screen reader
        has to already know about a "polite" region before its content
        changes in order to announce it; one that appears with its text
        already inside it is easy to miss entirely.
      */}
      <Text
        role="status"
        className={cn(
          "text-center text-sm text-muted-foreground",
          changed ? "mt-6" : "sr-only",
        )}
      >
        {changed ? t("auth.passwordChanged") : ""}
      </Text>

      {!signedIn ? (
        <>
          <Text className="mt-6 text-center text-sm text-muted-foreground">
            {t("auth.resetNeedsLink")}
          </Text>
          <p className="mt-4 text-center text-sm">
            <Link
              href="/reset"
              className="inline-flex min-h-11 items-center font-medium underline"
            >
              {t("auth.askForNewLink")}
            </Link>
          </p>
        </>
      ) : changed ? (
        <Button
          variant="pill"
          size="lg"
          className="mt-6 w-full justify-between"
          render={<Link href="/bearing" />}
        >
          {t("auth.openApp")}
          <ButtonNub>
            <ArrowRight size={ICON.md} weight="bold" />
          </ButtonNub>
        </Button>
      ) : (
        <>
          <p className="mt-1 text-center text-sm text-muted-foreground">
            {t("auth.newPasswordBody")}
          </p>
          <form onSubmit={save} className="mt-6 flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <FormLabel htmlFor="new-password">
                {t("auth.newPassword")}
              </FormLabel>
              <Input
                id="new-password"
                name="password"
                type="password"
                autoComplete="new-password"
                required
                minLength={6}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="text-base"
                aria-invalid={passwordHasError}
                aria-describedby={passwordHasError ? ERROR_ID : undefined}
              />
            </div>
            <div className="flex flex-col gap-2">
              <FormLabel htmlFor="confirm-password">
                {t("auth.confirmNewPassword")}
              </FormLabel>
              <Input
                id="confirm-password"
                name="confirm"
                type="password"
                autoComplete="new-password"
                required
                value={confirm}
                onChange={(event) => setConfirm(event.target.value)}
                className="text-base"
                aria-invalid={confirmHasError}
                aria-describedby={confirmHasError ? ERROR_ID : undefined}
              />
            </div>
            {error ? (
              <Text
                key={attempt}
                id={ERROR_ID}
                role="alert"
                className="text-center text-sm text-destructive"
              >
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
              {pending
                ? t("auth.savingNewPassword")
                : t("auth.saveNewPassword")}
              <ButtonNub>
                <ArrowRight size={ICON.md} weight="bold" />
              </ButtonNub>
            </Button>
          </form>
        </>
      )}
    </Card.Bezel>
  );
}

"use client";

import { useState } from "react";
import Link from "next/link";
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
import { newPasswordSchema } from "@finance/core/validations/finance";

export function NewPasswordForm({ signedIn }: { signedIn: boolean }) {
  const t = useT();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [changed, setChanged] = useState(false);

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const parsed = newPasswordSchema.safeParse({ password, confirm });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "errors.invalidInput");
      return;
    }

    setPending(true);
    const { error: updateError } = await createClient().auth.updateUser({
      password: parsed.data.password,
    });
    setPending(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }
    setChanged(true);
  }

  return (
    <Card.Bezel
      className="w-full max-w-md md:max-w-lg"
      innerClassName="p-6 md:p-8"
    >
      <h1 className="text-center font-head text-2xl md:text-3xl">
        {t("auth.newPasswordHeading")}
      </h1>

      {!signedIn ? (
        <>
          <Text className="mt-6 text-center text-sm text-muted-foreground">
            {t("auth.resetNeedsLink")}
          </Text>
          <p className="mt-4 text-center text-sm">
            <Link href="/reset" className="font-medium underline">
              {t("auth.sendResetLink")}
            </Link>
          </p>
        </>
      ) : changed ? (
        <>
          <Text
            role="status"
            className="mt-6 text-center text-sm text-muted-foreground"
          >
            {t("auth.passwordChanged")}
          </Text>
          <Button
            variant="pill"
            size="lg"
            className="mt-6 w-full justify-between"
            render={<Link href="/bearing" />}
          >
            {t("auth.openLedger")}
            <ButtonNub>
              <ArrowRight size={ICON.md} weight="bold" />
            </ButtonNub>
          </Button>
        </>
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
              />
            </div>
            {error ? (
              <Text
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

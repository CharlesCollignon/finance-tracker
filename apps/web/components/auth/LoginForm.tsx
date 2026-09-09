"use client";

import { useSearchParams } from "next/navigation";
import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight } from "@phosphor-icons/react";
import { Button, ButtonNub } from "@/components/retroui/Button";
import { Card } from "@/components/retroui/Card";
import { Input } from "@/components/retroui/Input";
import { FormLabel } from "@/components/layout/FormLabel";
import { Text } from "@/components/retroui/Text";
import { signIn } from "@/lib/actions/finance";
import { GoogleSignInButton } from "@/components/auth/GoogleSignInButton";
import { PasskeySignInButton } from "@/components/auth/PasskeySignInButton";
import { AuthDivider } from "@/components/auth/AuthDivider";
import { ICON } from "@/lib/icon-scale";
import { useT } from "@/lib/locale-context";

export function LoginForm() {
  const t = useT();
  const router = useRouter();
  const searchParams = useSearchParams();
  const authError = searchParams.get("error");
  const [state, action, pending] = useActionState(signIn, {});

  useEffect(() => {
    if (state.success) {
      router.push("/bearing");
      router.refresh();
    }
  }, [state.success, router]);

  return (
    <Card.Bezel
      className="w-full max-w-md md:max-w-lg"
      innerClassName="p-6 md:p-8"
    >
      <h1 className="text-center font-serif text-2xl italic md:text-3xl">
        Welcome back
      </h1>
      <p className="mt-1 text-center text-sm text-muted-foreground">
        {t("auth.signInHeading")}
      </p>
      <div className="mt-6 flex flex-col gap-2">
        <GoogleSignInButton label={t("auth.withGoogleSignIn")} />
        <PasskeySignInButton />
      </div>
      <AuthDivider />
      <form action={action} className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <FormLabel htmlFor="email">Email</FormLabel>
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
            autoComplete="current-password"
            required
            className="text-base"
          />
        </div>
        {(state.error || authError) && (
          <Text className="text-center text-sm text-destructive">
            {state.error ??
              "Sign-in link expired or invalid. Please try again."}
          </Text>
        )}
        <Button
          type="submit"
          variant="pill"
          size="lg"
          className="w-full justify-between"
          disabled={pending}
        >
          {pending ? t("auth.signingIn") : t("auth.signIn")}
          <ButtonNub>
            <ArrowRight size={ICON.md} weight="bold" />
          </ButtonNub>
        </Button>
      </form>
      <p className="mt-4 text-center text-sm text-muted-foreground">
        {t("auth.noAccount")}{" "}
        <Link href="/signup" className="font-medium underline">
          {t("auth.signUp")}
        </Link>
      </p>
    </Card.Bezel>
  );
}

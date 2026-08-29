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

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const authError = searchParams.get("error");
  const [state, action, pending] = useActionState(signIn, {});

  useEffect(() => {
    if (state.success) {
      router.push("/dashboard");
      router.refresh();
    }
  }, [state.success, router]);

  return (
    <Card.Bezel
      className="w-full max-w-md md:max-w-lg"
      innerClassName="p-6 md:p-8"
    >
      <h1 className="font-serif text-2xl italic md:text-3xl">Welcome back</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Sign in to track your finances
      </p>
      <div className="mt-6 flex flex-col gap-2">
        <GoogleSignInButton label="Sign in with Google" />
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
          <FormLabel htmlFor="password">Password</FormLabel>
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
          <Text className="text-sm text-destructive">
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
          {pending ? "Signing in…" : "Sign in"}
          <ButtonNub>
            <ArrowRight size={16} weight="bold" />
          </ButtonNub>
        </Button>
      </form>
      <p className="mt-4 text-center text-sm text-muted-foreground">
        No account?{" "}
        <Link href="/signup" className="font-medium underline">
          Sign up
        </Link>
      </p>
    </Card.Bezel>
  );
}

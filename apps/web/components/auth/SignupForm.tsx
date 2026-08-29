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

export function SignupForm() {
  const router = useRouter();
  const [state, action, pending] = useActionState(signUp, {});

  useEffect(() => {
    if (state.success && !state.message) {
      router.push("/dashboard");
      router.refresh();
    }
  }, [state.success, state.message, router]);

  return (
    <Card.Bezel
      className="w-full max-w-md md:max-w-lg"
      innerClassName="p-6 md:p-8"
    >
      <h1 className="font-serif text-2xl italic md:text-3xl">Create account</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Start tracking income and expenses
      </p>
      <div className="mt-6">
        <GoogleSignInButton label="Sign up with Google" />
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
            autoComplete="new-password"
            required
            minLength={6}
            className="text-base"
          />
        </div>
        {state.error && (
          <Text className="text-sm text-destructive">{state.error}</Text>
        )}
        {state.message && (
          <Text className="text-sm text-muted-foreground">{state.message}</Text>
        )}
        <Button
          type="submit"
          variant="pill"
          size="lg"
          className="w-full justify-between"
          disabled={pending}
        >
          {pending ? "Creating…" : "Sign up"}
          <ButtonNub>
            <ArrowRight size={16} weight="bold" />
          </ButtonNub>
        </Button>
      </form>
      <p className="mt-4 text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href="/login" className="font-medium underline">
          Sign in
        </Link>
      </p>
    </Card.Bezel>
  );
}

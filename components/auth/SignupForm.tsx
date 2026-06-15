"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/retroui/Button";
import { Card } from "@/components/retroui/Card";
import { Input } from "@/components/retroui/Input";
import { FormLabel } from "@/components/layout/FormLabel";
import { Text } from "@/components/retroui/Text";
import { signUp } from "@/lib/actions/finance";

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
    <Card className="w-full max-w-md">
      <Card.Header>
        <Card.Title>Create account</Card.Title>
        <Card.Description>Start tracking income and expenses</Card.Description>
      </Card.Header>
      <Card.Content>
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
          <Button type="submit" size="lg" className="w-full" disabled={pending}>
            {pending ? "Creating…" : "Sign up"}
          </Button>
        </form>
        <p className="mt-4 text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link href="/login" className="font-medium underline">
            Sign in
          </Link>
        </p>
      </Card.Content>
    </Card>
  );
}

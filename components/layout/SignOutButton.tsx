"use client";

import { Button } from "@/components/retroui/Button";
import { signOut } from "@/lib/actions/finance";
import { cn } from "@/lib/utils";

interface SignOutButtonProps {
  className?: string;
}

export function SignOutButton({ className }: SignOutButtonProps) {
  return (
    <form action={signOut}>
      <Button
        type="submit"
        variant="ghost"
        size="sm"
        className={cn("text-sm", className)}
      >
        Sign out
      </Button>
    </form>
  );
}

"use client";

import { Button } from "@/components/retroui/Button";
import { signOut } from "@/lib/actions/finance";

export function SignOutButton() {
  return (
    <form action={signOut}>
      <Button type="submit" variant="ghost" size="sm" className="text-sm">
        Sign out
      </Button>
    </form>
  );
}

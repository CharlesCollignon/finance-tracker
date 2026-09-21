"use client";

import { Button } from "@/components/retroui/Button";
import { signOut } from "@/lib/actions/finance";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/locale-context";

interface SignOutButtonProps {
  className?: string;
}

export function SignOutButton({ className }: SignOutButtonProps) {
  const t = useT();

  return (
    <form action={signOut}>
      <Button
        type="submit"
        variant="ghost"
        size="sm"
        className={cn("text-sm", className)}
      >
        {t("common.signOut")}
      </Button>
    </form>
  );
}

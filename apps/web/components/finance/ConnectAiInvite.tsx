"use client";

import Link from "next/link";
import { useT } from "@/lib/locale-context";
import { cn } from "@/lib/utils";

/**
 * Where a written read would be, for an account that writes with its own AI
 * account and has not connected one: one quiet line, opening the Profile.
 * No button that would only refuse.
 */
export function ConnectAiInvite({ className }: { className?: string }) {
  const t = useT();
  return (
    <Link
      href="/profile"
      className={cn(
        "text-sm text-muted-foreground underline decoration-dotted underline-offset-4 hover:text-foreground",
        className,
      )}
    >
      {t("aiAccount.connectFirst")}
    </Link>
  );
}

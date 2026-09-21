"use client";

import { cn } from "@/lib/utils";

interface UserInitialProps {
  initial: string;
  name: string;
  className?: string;
  size?: "sm" | "md";
}

export function UserInitial({
  initial,
  name,
  className,
  size = "sm",
}: UserInitialProps) {
  return (
    <span
      aria-hidden
      title={name}
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full",
        // A raised surface rather than a gold disc. An avatar is an identity
        // marker, not an emphasis, and it sits in the chrome on every screen.
        "bg-muted font-head font-semibold text-foreground",
        size === "sm" ? "size-6 text-[11px]" : "size-7 text-xs",
        className,
      )}
    >
      {initial}
    </span>
  );
}

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/*
 * A solid card, left-aligned, at the card radius — the phone's shape. It was a
 * centred statement over a dashed outline, which reads as a placeholder that
 * failed to load rather than as a step, and broke the system's own rule
 * against dashed strokes.
 */

interface EmptyStateProps {
  title: string;
  description: string;
  className?: string;
  children?: ReactNode;
}

export function EmptyState({
  title,
  description,
  className,
  children,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "rounded-card border border-border bg-card p-card",
        className,
      )}
    >
      <p className="font-head text-base">{title}</p>
      <p className="mt-2 text-sm text-muted-foreground">{description}</p>
      {children && <div className="mt-4">{children}</div>}
    </div>
  );
}

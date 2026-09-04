import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface PrivateAmountProps {
  children: ReactNode;
  className?: string;
  /**
   * What this figure is, on hover.
   *
   * Added for the month read, where a figure sits inside a sentence and the
   * label that would normally identify it is not beside it — so hovering is
   * how a reader checks which datum a number came from.
   */
  title?: string;
}

/** Marks content to blur when privacy mode is on. */
export function PrivateAmount({
  children,
  className,
  title,
}: PrivateAmountProps) {
  return (
    <span
      title={title}
      className={cn("privacy-amount tabular-nums", className)}
    >
      {children}
    </span>
  );
}

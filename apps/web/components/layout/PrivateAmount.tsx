import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface PrivateAmountProps {
  children: ReactNode;
  className?: string;
}

/** Marks content to blur when privacy mode is on. */
export function PrivateAmount({ children, className }: PrivateAmountProps) {
  return (
    <span className={cn("privacy-amount tabular-nums", className)}>
      {children}
    </span>
  );
}

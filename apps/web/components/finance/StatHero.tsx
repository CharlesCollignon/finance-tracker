import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface StatHeroProps {
  label: string;
  amount: ReactNode;
  amountClassName?: string;
  subtitle?: ReactNode;
  status?: ReactNode;
  className?: string;
  /** lg = page hero; md = section KPI */
  size?: "md" | "lg";
}

const amountSizeClass: Record<"md" | "lg", string> = {
  lg: "text-4xl md:text-5xl",
  md: "text-2xl md:text-3xl",
};

/** Centered KPI block: quiet label, large amount, optional muted lines. */
export function StatHero({
  label,
  amount,
  amountClassName,
  subtitle,
  status,
  className,
  size = "lg",
}: StatHeroProps) {
  return (
    <div className={cn("flex w-full flex-col items-center text-center", className)}>
      <p className="text-sm font-medium text-muted-foreground">{label}</p>
      <p
        className={cn(
          "privacy-amount mt-2 font-head font-semibold tracking-tight tabular-nums",
          amountSizeClass[size],
          amountClassName,
        )}
      >
        {amount}
      </p>
      {subtitle ? (
        <div className="mt-2 text-sm text-muted-foreground">{subtitle}</div>
      ) : null}
      {status ? <div className="mt-2 text-sm font-medium">{status}</div> : null}
    </div>
  );
}

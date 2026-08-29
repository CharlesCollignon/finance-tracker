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
  lg: "text-5xl md:text-6xl lg:text-7xl",
  md: "text-2xl md:text-3xl",
};

/** lg is the one hero figure per screen (Fraunces); md figures stay in the ledger mono. */
const amountFontClass: Record<"md" | "lg", string> = {
  lg: "font-serif",
  md: "font-mono",
};

/** md is a compact section KPI (e.g. Wallets card) that needs a tighter rhythm than a page hero. */
const gapClass: Record<"md" | "lg", string> = {
  lg: "mt-2",
  md: "mt-1",
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
    <div
      className={cn("flex w-full flex-col items-center text-center", className)}
    >
      {label ? (
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
      ) : null}
      <p
        className={cn(
          "privacy-amount font-semibold tracking-tight tabular-nums",
          label ? gapClass[size] : undefined,
          amountFontClass[size],
          amountSizeClass[size],
          amountClassName,
        )}
      >
        {amount}
      </p>
      {subtitle ? (
        <div className={cn(gapClass[size], "text-sm text-muted-foreground")}>
          {subtitle}
        </div>
      ) : null}
      {status ? (
        <div className={cn(gapClass[size], "text-sm font-medium")}>
          {status}
        </div>
      ) : null}
    </div>
  );
}

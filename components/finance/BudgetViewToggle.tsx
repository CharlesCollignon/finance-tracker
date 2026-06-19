"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  monthSearchParams,
  parseBudgetViewMode,
  parseMonthParams,
  type BudgetViewMode,
} from "@/lib/constants";
import { cn } from "@/lib/utils";

interface BudgetViewToggleProps {
  basePath: string;
  className?: string;
}

const OPTIONS: { value: BudgetViewMode; label: string }[] = [
  { value: "current", label: "Current" },
  { value: "month_end", label: "End of month" },
];

export function BudgetViewToggle({
  basePath,
  className,
}: BudgetViewToggleProps) {
  const searchParams = useSearchParams();
  const { year, month } = parseMonthParams(
    searchParams.get("y") ?? undefined,
    searchParams.get("m") ?? undefined,
  );
  const view = parseBudgetViewMode(searchParams.get("view"));

  return (
    <div
      className={cn(
        "inline-flex rounded border-2 border-border p-0.5",
        className,
      )}
      role="group"
      aria-label="Budget view"
    >
      {OPTIONS.map((option) => {
        const active = view === option.value;

        return (
          <Link
            key={option.value}
            href={`${basePath}${monthSearchParams(year, month, option.value)}`}
            className={cn(
              "rounded px-2.5 py-1.5 text-xs font-medium sm:px-3 sm:text-sm",
              active
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-accent hover:text-foreground",
            )}
            aria-pressed={active}
          >
            {option.label}
          </Link>
        );
      })}
    </div>
  );
}

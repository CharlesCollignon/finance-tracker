"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  budgetViewOptionLabel,
  monthSearchParams,
  parseBudgetViewMode,
  parseMonthParams,
  type BudgetViewMode,
} from "@finance/core/constants";
import { cn } from "@/lib/utils";

interface BudgetViewToggleProps {
  basePath: string;
  className?: string;
}

const OPTIONS: BudgetViewMode[] = ["current", "month_end"];

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
        "inline-flex max-w-full rounded-md border border-border p-0.5",
        className,
      )}
      role="group"
      aria-label="Budget view"
    >
      {OPTIONS.map((value) => {
        const active = view === value;
        const label = budgetViewOptionLabel(value, year, month);

        return (
          <Link
            key={value}
            href={`${basePath}${monthSearchParams(year, month, value)}`}
            title={label}
            className={cn(
              "rounded-md px-2 py-1.5 text-xs font-medium sm:px-3 sm:text-sm",
              "whitespace-nowrap",
              active
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
            aria-pressed={active}
          >
            {label}
          </Link>
        );
      })}
    </div>
  );
}

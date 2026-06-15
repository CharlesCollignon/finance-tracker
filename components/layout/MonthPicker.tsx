"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CaretLeft, CaretRight } from "@phosphor-icons/react";
import {
  formatMonthLabel,
  monthSearchParams,
  parseMonthParams,
  shiftMonth,
} from "@/lib/constants";
import { cn } from "@/lib/utils";

interface MonthPickerProps {
  basePath: string;
  className?: string;
}

export function MonthPicker({ basePath, className }: MonthPickerProps) {
  const searchParams = useSearchParams();
  const { year, month } = parseMonthParams(
    searchParams.get("y") ?? undefined,
    searchParams.get("m") ?? undefined,
  );

  const prev = shiftMonth(year, month, -1);
  const next = shiftMonth(year, month, 1);

  return (
    <div className={cn("flex items-center gap-1", className)}>
      <Link
        href={`${basePath}${monthSearchParams(prev.year, prev.month)}`}
        className={cn(
          "flex h-11 w-11 items-center justify-center rounded",
          "border-2 border-border shadow-sm hover:bg-accent",
        )}
        aria-label="Previous month"
      >
        <CaretLeft size={20} weight="bold" />
      </Link>
      <span className="min-w-[9rem] text-center text-sm font-medium">
        {formatMonthLabel(year, month)}
      </span>
      <Link
        href={`${basePath}${monthSearchParams(next.year, next.month)}`}
        className={cn(
          "flex h-11 w-11 items-center justify-center rounded",
          "border-2 border-border shadow-sm hover:bg-accent",
        )}
        aria-label="Next month"
      >
        <CaretRight size={20} weight="bold" />
      </Link>
    </div>
  );
}

export function useSelectedMonth() {
  const searchParams = useSearchParams();
  return parseMonthParams(
    searchParams.get("y") ?? undefined,
    searchParams.get("m") ?? undefined,
  );
}

"use client";

import type { CurrencyCode } from "@finance/core/constants";
import { setCurrencyPreference, useCurrency } from "@/lib/use-currency";
import { cn } from "@/lib/utils";

const OPTIONS: { value: CurrencyCode; label: string }[] = [
  { value: "EUR", label: "Euro (€)" },
  { value: "USD", label: "US Dollar ($)" },
];

/** Switches how amounts are labeled — this never converts values, only the symbol. */
export function CurrencyToggle({ className }: { className?: string }) {
  const currency = useCurrency();

  return (
    <div
      className={cn(
        "inline-flex max-w-full rounded-full border border-border p-1",
        className,
      )}
      role="group"
      aria-label="Display currency"
    >
      {OPTIONS.map((option) => {
        const active = currency === option.value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => setCurrencyPreference(option.value)}
            className={cn(
              "rounded-full px-3 py-1.5 text-xs font-medium sm:text-sm",
              "whitespace-nowrap transition-colors duration-300",
              active
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
            aria-pressed={active}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

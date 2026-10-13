"use client";

import { m } from "motion/react";
import { marketingFocus } from "@/components/marketing/marketing-focus";
import { cn } from "@/lib/utils";

/** The tabs' spring (`SurfaceTabs`): quick, a little springy. */
const PILL_SPRING = { type: "spring", stiffness: 400, damping: 30 } as const;

/**
 * A row of choices on the marketing site, the chosen one under a pill that
 * slides to it (« Nouveautés »' filters, Entraide's). `id` names the pill,
 * which must be unique on the page. Needs a `LazyMotion` with the layout
 * features above it for the slide; without them the pill simply moves.
 */
export function SegmentedPills<T extends string>({
  id,
  label,
  value,
  onChange,
  options,
}: {
  id: string;
  label: string;
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string; dot?: string }[];
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className="-mx-6 overflow-x-auto px-6 [scrollbar-width:none] md:mx-0 md:px-0"
    >
      <div className="inline-flex rounded-full border border-white/10 bg-white/[0.04] p-1">
        {options.map((option) => {
          const active = option.value === value;
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={active}
              onClick={() => onChange(option.value)}
              className={cn(
                "relative flex min-h-9 shrink-0 items-center gap-2 whitespace-nowrap rounded-full px-3.5 text-sm transition-colors duration-hover",
                marketingFocus,
                active
                  ? "text-marketing-ink"
                  : "text-marketing-muted hover:text-white",
              )}
            >
              {active ? (
                <m.span
                  layoutId={`${id}-pill`}
                  className="absolute inset-0 rounded-full bg-white/[0.12]"
                  transition={PILL_SPRING}
                  aria-hidden
                />
              ) : null}
              {option.dot ? (
                <span
                  className={cn("relative size-1.5 rounded-full", option.dot)}
                  aria-hidden
                />
              ) : null}
              <span className="relative">{option.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

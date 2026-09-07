import type { ReactNode } from "react";
import { CaretDown } from "@phosphor-icons/react/dist/ssr";

import { cn } from "@/lib/utils";
import { ICON } from "@/lib/icon-scale";

/**
 * A section the screen offers rather than asserts.
 *
 * Month had every block stacked at equal weight, which is a screen with no
 * answer to "how is the month going" — everything is shouting the same
 * volume. The figures that answer that question stay above; the ones that
 * elaborate on it live here, one click away and closed by default.
 *
 * Closed is the resting state on purpose: a disclosure that remembers being
 * open is a disclosure that stops being a summary after the first visit.
 *
 * Built on `<details>` rather than on React state, which is what the phone's
 * twin has to use. That buys the correct semantics and keyboard behaviour for
 * free, keeps this renderable on the server, and leaves the whole thing
 * working before any JavaScript arrives. The chevron's rotation is a CSS
 * transition, so the reduced-motion rule in globals.css lands it at its end
 * angle rather than sweeping.
 */
export function Disclosure({
  label,
  children,
  className,
  contentClassName,
}: {
  label: string;
  children: ReactNode;
  className?: string;
  /** Lets the caller lay the revealed blocks out — a grid on a wide screen. */
  contentClassName?: string;
}) {
  return (
    <details className={cn("group", className)}>
      <summary
        className={cn(
          "flex cursor-pointer list-none items-center justify-center gap-1.5 py-1",
          "text-xs font-semibold uppercase tracking-wide text-muted-foreground",
          "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
          "[&::-webkit-details-marker]:hidden",
        )}
      >
        <span className="group-open:hidden">{label}</span>
        <span className="hidden group-open:inline">Less</span>
        <CaretDown
          size={ICON.md}
          className="transition-transform duration-200 group-open:rotate-180"
        />
      </summary>
      <div className={cn("mt-4 flex flex-col gap-4", contentClassName)}>
        {children}
      </div>
    </details>
  );
}

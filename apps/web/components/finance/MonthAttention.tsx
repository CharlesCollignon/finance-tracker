import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowRight } from "@phosphor-icons/react/dist/ssr";
import { cn } from "@/lib/utils";
import { GLASS_CARD } from "@/lib/glass";

export interface AttentionItem {
  /** Stable key, and the reason this row exists. */
  id: string;
  /** What is waiting, in the user's words. */
  text: string;
  /** Where the decision gets made. */
  href: string;
  action: string;
  /**
   * Whether this is something gone wrong or merely something outstanding.
   * Most of the time it is the latter, and dressing it in red teaches people
   * to ignore the colour when it finally means something.
   */
  tone?: "waiting" | "wrong";
}

interface MonthAttentionProps {
  items: AttentionItem[];
  /**
   * Rows that ask a question rather than send you somewhere.
   *
   * Everything in `items` is a link: the decision is made on another surface.
   * Confirming that a charge arrived is decided here, which needs buttons and
   * therefore a client component — so it arrives as a slot rather than as an
   * item. Rendered above the links, because a question in front of you
   * outranks an errand somewhere else.
   */
  slot?: ReactNode;
}

/**
 * The only part of the month that wants a decision.
 *
 * Home used to open with a figure, and everything that actually needed doing
 * — entries the feed could not categorise, a month ready to close, a standing
 * charge the statement had found — was scattered across three other screens
 * or buried below the fold. The figure is not urgent. These are, and they are
 * finite: when there is nothing outstanding this block is not empty, it is
 * absent, which is the strongest thing an interface can say about a quiet
 * month.
 */
export function MonthAttention({ items, slot }: MonthAttentionProps) {
  if (items.length === 0 && !slot) {
    return null;
  }

  return (
    <section
      aria-label="Needs you"
      className={cn(
        "overflow-hidden rounded-3xl border-primary-rim/40",
        GLASS_CARD,
      )}
    >
      <h2 className="border-b border-foreground/10 px-4 py-2.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
        Needs you
      </h2>

      {/* Wrapped here rather than dropped in as a bare sibling. A slot handed
          in from a server component is not marked as key-checked, and React
          reports it as a missing key on a list it did not create — see the
          note in PageContainer. */}
      {slot ? <div className="flex flex-col">{slot}</div> : null}

      <ul className="flex flex-col">
        {items.map((item) => (
          <li
            key={item.id}
            className="border-b border-foreground/10 last:border-0"
          >
            <Link
              href={item.href}
              className={cn(
                "group flex items-center gap-3 px-4 py-3",
                "transition-colors hover:bg-muted/60",
              )}
            >
              <span
                aria-hidden
                className={cn(
                  "size-2 shrink-0 rounded-full",
                  item.tone === "wrong" ? "bg-destructive" : "bg-primary",
                )}
              />
              <span className="min-w-0 flex-1 text-sm">{item.text}</span>
              <span className="flex shrink-0 items-center gap-1 text-sm font-medium text-primary-ink">
                {item.action}
                <ArrowRight
                  size={14}
                  className="transition-transform group-hover:translate-x-0.5"
                />
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

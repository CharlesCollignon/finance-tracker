import Link from "next/link";
import { ArrowRight } from "@phosphor-icons/react/dist/ssr";
import { cn } from "@/lib/utils";

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
export function MonthAttention({ items }: MonthAttentionProps) {
  if (items.length === 0) {
    return null;
  }

  return (
    <section
      aria-label="Needs you"
      className="overflow-hidden rounded-xl border border-primary-rim/40 bg-card"
    >
      <h2 className="border-b border-border px-4 py-2.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
        Needs you
      </h2>
      <ul className="flex flex-col">
        {items.map((item) => (
          <li key={item.id} className="border-b border-border last:border-0">
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

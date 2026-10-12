import { cn } from "@/lib/utils";

/**
 * Something said to be live, at the top of a page: a dot in the status
 * green with its ring going out (`.about-live`, still under reduced motion)
 * and its words. The about page's beta, Nouveautés' last update.
 */
export function LiveStatus({
  label,
  className,
}: {
  label: string;
  className?: string;
}) {
  return (
    <p
      className={cn(
        "inline-flex min-h-9 items-center gap-2.5 rounded-full border border-white/12 bg-white/[0.06] px-4 text-sm text-marketing-ink backdrop-blur-xl",
        className,
      )}
    >
      <span className="relative flex size-2" aria-hidden>
        <span className="about-live absolute inset-0 rounded-full bg-success" />
        <span className="relative size-2 rounded-full bg-success" />
      </span>
      {label}
    </p>
  );
}

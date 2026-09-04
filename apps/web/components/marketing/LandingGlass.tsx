import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * The marketing site's glass vocabulary.
 *
 * These deliberately reach for `white/xx` rather than `--muted-foreground`.
 * The app's muted grey is cool by design — it sits on a near-black card and
 * must not compete with the gold. These panels sit on the *orb*, on warm
 * light, where the cool grey turns visibly blue. Warm white alpha is the
 * correct answer on this surface and the wrong one everywhere else, which is
 * why it lives here and not in a token.
 *
 * All of it is server-rendered: the arrow is an inline SVG rather than a
 * Phosphor import so a decorative glyph does not drag the icon runtime into
 * the hero's bundle.
 */

function ArrowNub({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
        "border border-white/15 bg-white/10 text-white/80",
        "transition-all duration-300 [transition-timing-function:cubic-bezier(0.32,0.72,0,1)]",
        "group-hover:border-white/25 group-hover:bg-white/20 group-hover:text-white",
        "group-hover:-translate-y-0.5 group-hover:translate-x-0.5",
        className,
      )}
      aria-hidden
    >
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
        <path
          d="M3 9L9 3M9 3H4M9 3V8"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

/** A row of rounded bars, each a 0–1 fraction of the row's height. */
function Sparkbars({
  values,
  tone = "gold",
}: {
  values: readonly number[];
  tone?: "gold" | "neutral";
}) {
  return (
    <div className="flex h-8 items-end gap-[3px]" aria-hidden>
      {values.map((value, index) => (
        <div
          key={index}
          className={cn(
            // Fixed narrow width, not flex-1: stretched to fill a wide card
            // each bar becomes a capsule and the rounding eats the very
            // differences in height the row exists to show.
            "w-1.5 shrink-0 rounded-full",
            tone === "gold" ? "bg-primary/70" : "bg-white/25",
            // The last bar is the month being read, so it is the lit one.
            index === values.length - 1 &&
              (tone === "gold" ? "bg-primary" : "bg-white/60"),
          )}
          style={{ height: `${Math.max(8, value * 100)}%` }}
        />
      ))}
    </div>
  );
}

interface GlassStatProps {
  label: string;
  value: string;
  caption?: string;
  /** Bar heights, 0–1, oldest first. The final bar reads as "now". */
  spark?: readonly number[];
  sparkTone?: "gold" | "neutral";
  /** A filled fraction, 0–1, for a single-track meter instead of bars. */
  meter?: number;
  href?: string;
  className?: string;
}

/**
 * One floating figure: quiet label, one number, and a small reading of its
 * history. The arrow is what makes it read as a card you could open rather
 * than a decal, so it is present whether or not there is a link behind it.
 */
export function GlassStat({
  label,
  value,
  caption,
  spark,
  sparkTone = "gold",
  meter,
  href,
  className,
}: GlassStatProps) {
  const body = (
    <>
      <div className="flex items-start justify-between gap-8">
        <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-white/55">
          {label}
        </p>
        {href ? <ArrowNub /> : null}
      </div>
      <p className="mt-3 font-mono text-2xl font-medium tabular-nums text-white sm:text-[1.75rem]">
        {value}
      </p>
      {caption ? <p className="mt-1 text-xs text-white/45">{caption}</p> : null}
      {spark ? (
        <div className="mt-4">
          <Sparkbars values={spark} tone={sparkTone} />
        </div>
      ) : null}
      {meter !== undefined ? (
        <div className="mt-4 h-1 w-full overflow-hidden rounded-full bg-white/12">
          <div
            className="h-full rounded-full bg-primary"
            style={{ width: `${Math.min(1, Math.max(0, meter)) * 100}%` }}
          />
        </div>
      ) : null}
    </>
  );

  // Width is the caller's business: these are positioned over artwork, and
  // what fits differs at every one of those positions.
  const shell = cn(
    "glass-panel group block rounded-[1.25rem] px-5 py-4 text-left",
    className,
  );

  if (href) {
    return (
      <Link href={href} className={shell}>
        {body}
      </Link>
    );
  }

  return <div className={shell}>{body}</div>;
}

/** A card in the feature grid: icon slot, title, one line, arrow on hover. */
export function GlassLink({
  href,
  title,
  body,
  icon,
  className,
}: {
  href: string;
  title: string;
  body: string;
  icon?: React.ReactNode;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "glass-flat glass-flat-hover group flex flex-col rounded-2xl p-5",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-4">
        {icon ? (
          <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-primary">
            {icon}
          </span>
        ) : null}
        <ArrowNub className="ml-auto" />
      </div>
      <h3 className="mt-4 font-head text-base text-white">{title}</h3>
      <p className="mt-1.5 text-sm leading-relaxed text-white/50">{body}</p>
    </Link>
  );
}

import Link from "next/link";
import { marketingFocus } from "@/components/marketing/marketing-focus";
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
        "border border-white/15 bg-white/10 text-marketing-ink",
        "transition-all duration-hover [transition-timing-function:cubic-bezier(0.32,0.72,0,1)]",
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

/** A row of rounded-control bars, each a 0–1 fraction of the row's height. */
interface GlassStatProps {
  label: string;
  value: string;
  caption?: string;
  /** Bar heights, 0–1, oldest first. The final bar reads as "now". */
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
/* There was a `spark` prop here that drew a row of bars from an array of
   fractions. Both arrays it was ever given were invented trends — unrecorded
   spending falling by two thirds over a year, what you keep more than
   doubling — which `PRODUCT.md` forbids as an implied benchmark. The prop is
   gone rather than left unused, because a component that renders a slope from
   numbers nobody measured is an invitation to do it again. `meter` stays: it
   takes a single ratio, and every caller passes one the sample month
   actually contains. */

export function GlassStat({
  label,
  value,
  caption,
  meter,
  href,
  className,
}: GlassStatProps) {
  const body = (
    <>
      <div className="flex items-start justify-between gap-8">
        <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-marketing-muted">
          {label}
        </p>
        {href ? <ArrowNub /> : null}
      </div>
      {/* Ink, and deliberately not Lamplit Gold.
          DESIGN.md reserves a third home for the accent — "a figure that
          genuinely leads a screen" — and these are the only figures on the
          public site, so the question is a fair one. Three things answer it.

          The panels sit on the orb, on warm light. That is already why they
          reach for warm white alpha instead of the app's cool `muted-
          foreground`; gold ink on a warm-lit translucent pane separates from
          its own background less than white does, so the accent would read as
          a tint of the artwork rather than as the system's one emphasis.

          "A figure that leads a screen" is singular, and there are five of
          these — two in the hero, three beside the close. One component cannot
          hold a distinction it has no way to defend, and a `lead` flag would
          be set everywhere within a release. The app's own sweep left
          `text-primary-ink` at exactly one call site, in `ProjectionCard`.

          And the hero's gold is spoken for: `LandingCtas` is a gold fill
          sitting a few rems above these cards. Two golds in one viewport, one
          of them the primary action, costs the action. The figure that leads
          this page is the display headline; the cards are its evidence. */}
      <p className="mt-3 font-mono text-2xl font-medium tabular-nums text-marketing-ink sm:text-[1.75rem]">
        {value}
      </p>
      {caption ? (
        <p className="mt-1 text-xs text-marketing-muted">{caption}</p>
      ) : null}
      {meter !== undefined ? (
        /* The fill is ink, not the accent. A meter is data — the app draws its
           own in `bg-success`, `bg-destructive` or a chart colour over a
           `foreground/10` track, and never in gold, because the gold on these
           pages belongs to the button underneath them. 8.66:1 against the
           track and 12.47:1 against the panel. */
        <div className="mt-4 h-1 w-full overflow-hidden rounded-full bg-white/12">
          <div
            className="h-full rounded-full bg-marketing-ink"
            style={{ width: `${Math.min(1, Math.max(0, meter)) * 100}%` }}
          />
        </div>
      ) : null}
    </>
  );

  // Width is the caller's business: these are positioned over artwork, and
  // what fits differs at every one of those positions.
  const shell = cn(
    "glass-panel group block rounded-card px-5 py-4 text-left",
    className,
  );

  if (href) {
    // The ring goes on the link and not on the shell: without an `href` this
    // is a figure on a panel, which is not focusable and must not look as
    // though it were.
    return (
      <Link href={href} className={cn(shell, marketingFocus)}>
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
        "glass-flat glass-flat-hover group flex flex-col rounded-card p-card",
        marketingFocus,
        className,
      )}
    >
      <div className="flex items-start justify-between gap-4">
        {/* Ink, not gold. Seven cards each carrying a gold glyph was the
            single largest spend of the accent on this surface, and the seven
            of them said nothing the card's title does not — the mark belongs
            to the surface it names, not to an emphasis it was never given.
            11.50:1 inside the chip, well past the 3:1 a glyph needs. */}
        {icon ? (
          <span className="flex h-9 w-9 items-center justify-center rounded-control border border-white/10 bg-white/5 text-marketing-ink">
            {icon}
          </span>
        ) : null}
        <ArrowNub className="ml-auto" />
      </div>
      <h3 className="mt-4 font-head text-base text-marketing-ink">{title}</h3>
      <p className="mt-1.5 text-sm leading-relaxed text-marketing-muted">
        {body}
      </p>
    </Link>
  );
}

import { Orb } from "@/components/brand/Orb";
import { cn } from "@/lib/utils";

type LogoSize = "nav" | "hero";
type LogoTag = "span" | "h1" | "div";

interface LogoProps {
  className?: string;
  size?: LogoSize;
  /** Element to render. Use "h1" for the one instance that is the page's main heading. */
  as?: LogoTag;
  /** Drop the wordmark and show only the orb (tight spots, avatars). */
  markOnly?: boolean;
  /** Drop the orb, e.g. where a larger one is already on screen. */
  showMark?: boolean;
}

const sizeStyles: Record<LogoSize, string> = {
  nav: "text-[1.75rem] md:text-[2rem]",
  hero: "text-[3.25rem] sm:text-[4rem]",
};

/** Orb pixel size per logo size. */
const markSize: Record<LogoSize, number> = {
  nav: 32,
  hero: 64,
};

/**
 * The brand lockup: the live orb and the word.
 *
 * There used to be a choice of artwork here — the bare orb, or a full
 * composition of the orb and the P it drew, which shipped as a flat cream
 * plate and so had to be clipped to a rounded square to look deliberate.
 * Both were PNGs. The orb is a component now, and a component can be
 * transparent, turn, and pick up whatever is behind it, none of which a
 * render can; the plate went with them, since a lockup that needs its own
 * opaque ground cannot float on a page.
 */
export function Logo({
  className,
  size = "nav",
  as: Tag = "span",
  markOnly = false,
  showMark = true,
}: LogoProps) {
  const px = markSize[size];

  return (
    <Tag
      className={cn(
        "inline-flex items-center gap-2 font-logo leading-none text-foreground",
        sizeStyles[size],
        className,
      )}
      aria-label="Pluclair"
    >
      {showMark ? (
        <Orb size={`${px}px`} tone="mark" className="shrink-0" />
      ) : null}
      {markOnly ? null : "Pluclair"}
    </Tag>
  );
}

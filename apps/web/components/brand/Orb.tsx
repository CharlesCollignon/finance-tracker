import { cn } from "@/lib/utils";

/**
 * How much glass. The hero's orb is a near-clear shell, which only works
 * because it has a whole hero's worth of dark sky behind it; a mark 22px
 * across over a scrolling header band needs the tint thickened or it reads
 * as a smudge. See `--orb-glass` in globals.css.
 */
type OrbTone = "hero" | "mark";

interface OrbProps {
  /**
   * A CSS length for both axes. Left off, the orb takes its size from
   * `className` — which is how the hero uses it, since a fluid
   * `min(58vw,352px)` cannot be written here as a number. Every blur and
   * inset scales off the rendered width either way (see `.pc-orb` in
   * globals.css).
   */
  size?: string;
  className?: string;
  tone?: OrbTone;
}

/**
 * The Pluclair orb: a glass shell with warm clouds turning slowly inside it.
 *
 * Two empty divs and a stylesheet, which is what keeps it a server component
 * — it can sit in the app header and the marketing footer without either of
 * them becoming client-rendered. The CSS lives in globals.css rather than in
 * a `<style jsx>` block, because styled-jsx in the App Router needs a client
 * component and a style registry: a steep price for a decoration, and it
 * would put every header behind a hydration wait.
 *
 * The inner div is the second cloud layer, turning against the first and
 * breathing on a period of its own. It is a real element because the outer
 * div's two pseudo-elements are already spoken for — `::before` is the first
 * cloud layer, `::after` the optics — and a third layer had nowhere else to
 * live. At `tone="mark"` the stylesheet hides it and stops the interior's
 * wander, because neither survives being 22px across.
 *
 * Always decorative. The wordmark beside it carries the accessible name, and
 * where the orb stands alone the caller labels its own container.
 */
export function Orb({ size, className, tone = "hero" }: OrbProps) {
  return (
    <div
      className={cn("pc-orb", tone === "mark" && "pc-orb-mark", className)}
      style={{ width: size, height: size }}
      aria-hidden
    >
      <div className="pc-orb-clouds" />
    </div>
  );
}

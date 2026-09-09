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
 * The Pluclair orb: a glass shell with gold clouds turning slowly inside it.
 *
 * The whole thing is one empty div and a stylesheet, which is what keeps it a
 * server component — it can sit in the app header and the marketing footer
 * without either of them becoming client-rendered. The CSS lives in
 * globals.css rather than in a `<style jsx>` block, because styled-jsx in the
 * App Router needs a client component and a style registry: a steep price for
 * a decoration, and it would put every header behind a hydration wait.
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
    />
  );
}

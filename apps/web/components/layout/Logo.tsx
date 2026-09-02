import Image from "next/image";
import { cn } from "@/lib/utils";

type LogoSize = "nav" | "hero";
type LogoTag = "span" | "h1" | "div";
type LogoMark = "orb" | "full";

interface LogoProps {
  className?: string;
  size?: LogoSize;
  /** Element to render. Use "h1" for the one instance that is the page's main heading. */
  as?: LogoTag;
  /**
   * Which artwork. The orb is transparent and reads down to about 20px; the
   * full composition — orb and the P it draws — is a flat cream plate, so it
   * needs room and a frame. See the note on `markSrc`.
   */
  mark?: LogoMark;
  /** Drop the wordmark and show only the mark (tight spots, avatars). */
  markOnly?: boolean;
  /** Drop the mark, e.g. where a larger logo is already on screen. */
  showMark?: boolean;
}

const sizeStyles: Record<LogoSize, string> = {
  nav: "text-[1.75rem] md:text-[2rem]",
  hero: "text-[3.25rem] sm:text-[4rem]",
};

/** Mark pixel size per logo size. */
const markSize: Record<LogoSize, number> = {
  nav: 32,
  hero: 64,
};

/**
 * The full composition ships with its cream ground baked in — there is no
 * transparent export of it — so it cannot float on a page the way the orb
 * can. Rounding and clipping it turns that into the point: it reads as the
 * logo on its own plate, which is exactly what the app icon is.
 */
const markStyles: Record<LogoMark, string> = {
  orb: "",
  full: "overflow-hidden rounded-[22%]",
};

const markSrc: Record<LogoMark, string> = {
  orb: "/logo-mark.png",
  full: "/logo-full.png",
};

export function Logo({
  className,
  size = "nav",
  as: Tag = "span",
  mark = "orb",
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
        <Image
          src={markSrc[mark]}
          alt=""
          aria-hidden
          width={px}
          height={px}
          priority
          className={cn("shrink-0", markStyles[mark])}
          style={{ width: px, height: px }}
        />
      ) : null}
      {markOnly ? null : "Pluclair"}
    </Tag>
  );
}

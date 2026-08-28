import Image from "next/image";
import { cn } from "@/lib/utils";

type LogoSize = "nav" | "hero";
type LogoTag = "span" | "h1" | "div";

interface LogoProps {
  className?: string;
  size?: LogoSize;
  /** Element to render. Use "h1" for the one instance that is the page's main heading. */
  as?: LogoTag;
  /** Drop the wordmark and show only the mark (tight spots, avatars). */
  markOnly?: boolean;
}

const sizeStyles: Record<LogoSize, string> = {
  nav: "text-[1.75rem] md:text-[2rem]",
  hero: "text-[3.25rem] sm:text-[4rem]",
};

/** Mark pixel size per logo size; the artwork carries its own rounded tile. */
const markSize: Record<LogoSize, number> = {
  nav: 32,
  hero: 64,
};

export function Logo({
  className,
  size = "nav",
  as: Tag = "span",
  markOnly = false,
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
      <Image
        src="/logo-mark.png"
        alt=""
        aria-hidden
        width={px}
        height={px}
        priority
        className="shrink-0"
        style={{ width: px, height: px }}
      />
      {markOnly ? null : "Pluclair"}
    </Tag>
  );
}

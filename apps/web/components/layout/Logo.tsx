import { cn } from "@/lib/utils";

type LogoSize = "nav" | "hero";
type LogoTag = "span" | "h1";

interface LogoProps {
  className?: string;
  size?: LogoSize;
  /** Element to render. Use "h1" for the one instance that is the page's main heading. */
  as?: LogoTag;
}

const sizeStyles: Record<LogoSize, string> = {
  nav: "text-[1.75rem] md:text-[2rem]",
  hero: "text-[3.25rem] sm:text-[4rem]",
};

export function Logo({ className, size = "nav", as: Tag = "span" }: LogoProps) {
  return (
    <Tag
      className={cn(
        "font-logo leading-none text-foreground",
        sizeStyles[size],
        className,
      )}
      aria-label="Pluclair"
    >
      Pluclair
    </Tag>
  );
}

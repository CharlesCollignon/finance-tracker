import { cn } from "@/lib/utils";

type LogoSize = "nav" | "hero";

interface LogoProps {
  className?: string;
  size?: LogoSize;
}

const sizeStyles: Record<LogoSize, string> = {
  nav: "text-[1.75rem] md:text-[2rem]",
  hero: "text-[3.25rem] sm:text-[4rem]",
};

export function Logo({ className, size = "nav" }: LogoProps) {
  return (
    <span
      className={cn(
        "font-logo leading-none text-foreground",
        sizeStyles[size],
        className,
      )}
      aria-label="Pluclair"
    >
      Pluclair
    </span>
  );
}

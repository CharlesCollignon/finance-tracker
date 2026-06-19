import { cn } from "@/lib/utils";

type LogoSize = "nav" | "hero";

interface LogoProps {
  className?: string;
  size?: LogoSize;
}

const sizeStyles: Record<
  LogoSize,
  { mark: string; tagline: string; gap: string }
> = {
  nav: {
    mark: "text-[2.25rem]",
    tagline: "mt-0.5 text-[10px] tracking-[0.14em]",
    gap: "gap-0",
  },
  hero: {
    mark: "text-[3.25rem] sm:text-[4rem]",
    tagline: "mt-1 text-[10px] tracking-[0.18em] sm:text-xs",
    gap: "gap-0",
  },
};

export function Logo({ className, size = "nav" }: LogoProps) {
  const styles = sizeStyles[size];

  return (
    <div
      className={cn(
        "flex flex-col items-center leading-none",
        styles.gap,
        className,
      )}
      aria-label="Finance tracker"
    >
      <span
        className={cn("font-logo leading-none", styles.mark)}
        aria-hidden
      >
        F
      </span>
      <span
        className={cn(
          "text-muted-foreground/70",
          styles.tagline,
        )}
      >
        Finance tracker
      </span>
    </div>
  );
}

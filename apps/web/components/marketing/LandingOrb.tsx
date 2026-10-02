import { cn } from "@/lib/utils";

/**
 * The orb's warm light on its own, for sections that want the brand's glow
 * behind them without a sphere in front. Always decorative.
 */
export function LandingBloom({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "marketing-bloom marketing-bloom-breathe pointer-events-none absolute rounded-full",
        className,
      )}
      style={{ filter: "blur(16px)" }}
      aria-hidden
    />
  );
}

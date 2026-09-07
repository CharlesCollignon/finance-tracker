import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { AnimatedAmount } from "@/components/finance/AnimatedAmount";
import { PrivateAmount } from "@/components/layout/PrivateAmount";
import { FIGURE_HERO } from "@/lib/type-scale";

interface StatHeroProps {
  label: string;
  /** The figure, already formatted. Ignored when `animateValue` is supplied. */
  amount: ReactNode;
  /** Supply with `format` to count the figure up when it changes. */
  animateValue?: number;
  format?: (value: number) => string;
  amountClassName?: string;
  subtitle?: ReactNode;
  status?: ReactNode;
  className?: string;
}

/**
 * Centred KPI block: quiet label, the screen's one figure, optional muted
 * lines under it.
 *
 * There used to be a `size` prop here, where `md` set its amount in the ledger
 * mono and `lg` in the serif. Neither client ever passed it — every call site
 * on web and on the phone took the default — so the two faces were never both
 * on screen, and the prop only existed to keep them from agreeing. The figure
 * treatment now comes from FIGURE_HERO, which carries the face along with the
 * size so a figure cannot pick up one without the other.
 */
export function StatHero({
  label,
  amount,
  animateValue,
  format,
  amountClassName,
  subtitle,
  status,
  className,
}: StatHeroProps) {
  const figureClass = cn(FIGURE_HERO, amountClassName);

  return (
    <div
      className={cn("flex w-full flex-col items-center text-center", className)}
    >
      {label ? (
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
      ) : null}
      <p className={label ? "mt-2" : undefined}>
        {animateValue !== undefined && format ? (
          <AnimatedAmount
            value={animateValue}
            format={format}
            className={figureClass}
          />
        ) : (
          <PrivateAmount className={figureClass}>{amount}</PrivateAmount>
        )}
      </p>
      {subtitle ? (
        <div className="mt-2 text-sm text-muted-foreground">{subtitle}</div>
      ) : null}
      {status ? <div className="mt-2 text-sm font-medium">{status}</div> : null}
    </div>
  );
}

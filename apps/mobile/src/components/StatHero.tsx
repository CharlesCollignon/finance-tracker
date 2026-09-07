import type { ReactNode } from "react";
import { View } from "react-native";

import { AnimatedAmount } from "@/components/AnimatedAmount";
import { PrivateAmount } from "@/components/PrivateAmount";
import { Text } from "@/components/ui/Text";
import { cn } from "@/lib/cn";
import { TYPE } from "@/theme/tokens";

interface StatHeroProps {
  label: string;
  amount: string;
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
 * mono and `lg` in the serif. No call site on either client ever passed it, so
 * the two faces were never both on screen and the prop only existed to keep
 * them from agreeing.
 *
 * The figure treatment arrives as `TYPE.hero` rather than as `text-*` and
 * `font-*` classes: the size has to come through `style` anyway — Tailwind's
 * size utilities set lineHeight too, and on Android that clipped this font's
 * taller glyphs — and carrying the face in the same token is what stops a
 * figure getting the size of a hero and the face of body copy.
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
  const figureClass = cn(label && "mt-2", amountClassName);

  return (
    <View className={cn("w-full items-center", className)}>
      {label ? (
        <Text className="text-sm font-medium text-muted-foreground">
          {label}
        </Text>
      ) : null}
      {animateValue !== undefined && format ? (
        <AnimatedAmount
          value={animateValue}
          format={format}
          style={TYPE.hero}
          className={figureClass}
        />
      ) : (
        <PrivateAmount style={TYPE.hero} className={figureClass}>
          {amount}
        </PrivateAmount>
      )}
      {subtitle ? (
        <View className="mt-2">
          <Text className="text-center text-sm text-muted-foreground">
            {subtitle}
          </Text>
        </View>
      ) : null}
      {status ? <View className="mt-2 items-center">{status}</View> : null}
    </View>
  );
}

import type { ReactNode } from "react";
import { View } from "react-native";

import { PrivateAmount } from "@/components/PrivateAmount";
import { Text } from "@/components/ui/Text";
import { cn } from "@/lib/cn";

type Size = "md" | "lg";

interface StatHeroProps {
  label: string;
  amount: string;
  amountClassName?: string;
  subtitle?: ReactNode;
  status?: ReactNode;
  className?: string;
  /** lg = page hero; md = section KPI */
  size?: Size;
}

const AMOUNT_SIZE: Record<Size, string> = {
  lg: "text-5xl",
  md: "text-2xl",
};

/** lg is the one hero figure per screen (Fraunces); md figures stay in the ledger mono. */
const AMOUNT_FONT: Record<Size, string> = {
  lg: "font-serif",
  md: "font-mono",
};

/** md is a compact section KPI that needs a tighter rhythm than a page hero. */
const GAP: Record<Size, string> = {
  lg: "mt-2",
  md: "mt-1",
};

/** Centered KPI block: quiet label, large amount, optional muted lines. */
export function StatHero({
  label,
  amount,
  amountClassName,
  subtitle,
  status,
  className,
  size = "lg",
}: StatHeroProps) {
  return (
    <View className={cn("w-full items-center", className)}>
      {label ? (
        <Text className="text-sm font-medium text-muted-foreground">
          {label}
        </Text>
      ) : null}
      <PrivateAmount
        className={cn(
          "font-semibold tracking-tight",
          label ? GAP[size] : undefined,
          AMOUNT_FONT[size],
          AMOUNT_SIZE[size],
          amountClassName,
        )}
      >
        {amount}
      </PrivateAmount>
      {subtitle ? (
        <View className={GAP[size]}>
          <Text className="text-center text-sm text-muted-foreground">
            {subtitle}
          </Text>
        </View>
      ) : null}
      {status ? (
        <View className={cn(GAP[size], "items-center")}>{status}</View>
      ) : null}
    </View>
  );
}

import type { ReactNode } from "react";
import { View } from "react-native";

import { PrivateAmount } from "@/components/PrivateAmount";
import { Text } from "@/components/ui/Text";
import { cn } from "@/lib/cn";

interface StatHeroProps {
  label: string;
  amount: string;
  tone?: "default" | "danger";
  subtitle?: ReactNode;
  status?: ReactNode;
  className?: string;
}

/** Centered KPI block: quiet label, one Fraunces amount, optional muted lines. */
export function StatHero({
  label,
  amount,
  tone = "default",
  subtitle,
  status,
  className,
}: StatHeroProps) {
  return (
    <View className={cn("w-full items-center", className)}>
      <Text variant="muted">{label}</Text>
      <PrivateAmount
        className={cn(
          "mt-2 font-serif text-4xl",
          tone === "danger"
            ? "text-destructive"
            : "text-primary-ink dark:text-primary-ink-dark",
        )}
      >
        {amount}
      </PrivateAmount>
      {subtitle ? (
        <Text variant="muted" className="mt-2 text-center">
          {subtitle}
        </Text>
      ) : null}
      {status ? <View className="mt-2">{status}</View> : null}
    </View>
  );
}

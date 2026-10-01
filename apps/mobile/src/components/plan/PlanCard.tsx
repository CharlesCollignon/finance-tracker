import type { ReactNode } from "react";
import { View } from "react-native";

import { Card } from "@/components/ui/Card";
import { Text } from "@/components/ui/Text";

/**
 * One section of the Plan: the translucent card with a hairline, no shadow,
 * and a bezel for the hero only.
 */
export function PlanCard({
  children,
  bezel,
}: {
  children: ReactNode;
  bezel?: boolean;
}) {
  return bezel ? (
    <Card bezel innerClassName="gap-4 p-5">
      {children}
    </Card>
  ) : (
    <Card className="gap-4 p-5">{children}</Card>
  );
}

/** The section's name, the line under it, and anything at its right. */
export function PlanCardHeader({
  title,
  subtitle,
  right,
}: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
}) {
  return (
    <View className="flex-row items-start justify-between gap-3">
      <View className="min-w-0 flex-1 gap-0.5">
        <Text
          accessibilityRole="header"
          className="font-semibold"
          style={{ fontSize: 16 }}
        >
          {title}
        </Text>
        {subtitle ? (
          <Text variant="muted" className="text-xs">
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right}
    </View>
  );
}

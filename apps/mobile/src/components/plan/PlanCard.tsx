import type { ReactNode } from "react";
import { Pressable, View } from "react-native";

import { Text } from "@/components/ui/Text";
import { cn } from "@/lib/cn";

/**
 * One section of the Plan screen: the web's `rounded-card p-card` surface
 * with a hairline, no bezel and no shadow.
 */
export function PlanCard({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <View
      className={cn(
        "gap-4 rounded-card border border-border bg-card p-card",
        className,
      )}
    >
      {children}
    </View>
  );
}

/**
 * The section's name, and on the right the quiet link that opens its form —
 * "Ajouter un budget", which turns into "Annuler" while the form is open.
 * A link rather than a button, as on the web: adding is not what the section
 * is for, reading it is.
 */
export function PlanCardHeader({
  title,
  action,
  onAction,
}: {
  title: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <View className="flex-row items-center justify-between gap-3">
      <Text accessibilityRole="header" className="text-sm font-medium">
        {title}
      </Text>
      {action && onAction ? (
        <Pressable
          accessibilityRole="button"
          hitSlop={8}
          onPress={onAction}
          className="min-h-11 justify-center px-1"
        >
          <Text className="text-sm font-medium text-foreground underline">
            {action}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

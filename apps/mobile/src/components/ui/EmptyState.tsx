import type { ReactNode } from "react";
import { View } from "react-native";

import { Text } from "@/components/ui/Text";
import { cn } from "@/lib/cn";

interface EmptyStateProps {
  title: string;
  description: string;
  className?: string;
  children?: ReactNode;
}

export function EmptyState({
  title,
  description,
  className,
  children,
}: EmptyStateProps) {
  return (
    <View
      className={cn(
        "rounded-lg border border-dashed border-border bg-card p-8",
        className,
      )}
    >
      <Text className="text-center text-base font-semibold">{title}</Text>
      <Text className="mt-2 text-center text-sm text-muted-foreground">
        {description}
      </Text>
      {children ? <View className="mt-4">{children}</View> : null}
    </View>
  );
}

import { View, type ViewProps } from "react-native";

import { cn } from "@/lib/cn";
import { BRUTAL_SHADOW } from "@/theme/tokens";

export interface CardProps extends ViewProps {
  className?: string;
}

export function Card({ className, style, ...props }: CardProps) {
  return (
    <View
      style={[BRUTAL_SHADOW, style]}
      className={cn("border-2 border-border bg-card p-4", className)}
      {...props}
    />
  );
}

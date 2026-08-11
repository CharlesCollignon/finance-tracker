import { View, type ViewProps } from "react-native";

import { cn } from "@/lib/cn";

export interface CardProps extends ViewProps {
  className?: string;
}

export function Card({ className, style, ...props }: CardProps) {
  return (
    <View
      style={style}
      className={cn(
        "rounded-lg border border-border bg-card p-4",
        "dark:border-border-dark dark:bg-card-dark",
        className,
      )}
      {...props}
    />
  );
}

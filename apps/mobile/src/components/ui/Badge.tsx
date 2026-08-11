import { Text, View, type ViewProps } from "react-native";

import { cn } from "@/lib/cn";

type Variant = "default" | "outline" | "solid" | "surface";

export interface BadgeProps extends ViewProps {
  label: string;
  variant?: Variant;
  className?: string;
}

const CONTAINER: Record<Variant, string> = {
  default: "bg-muted rounded-md",
  outline: "border border-border bg-transparent rounded-md",
  solid: "bg-foreground rounded-md",
  surface: "bg-primary/20 rounded-md",
};

const LABEL: Record<Variant, string> = {
  default: "text-muted-foreground",
  outline: "text-foreground",
  solid: "text-background",
  surface: "text-primary",
};

export function Badge({
  label,
  variant = "default",
  className,
  ...props
}: BadgeProps) {
  return (
    <View
      className={cn("self-start px-2.5 py-1", CONTAINER[variant], className)}
      {...props}
    >
      <Text className={cn("text-xs font-medium", LABEL[variant])}>{label}</Text>
    </View>
  );
}

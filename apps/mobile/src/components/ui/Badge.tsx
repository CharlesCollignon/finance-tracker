import { Text, View, type ViewProps } from "react-native";

import { cn } from "@/lib/cn";

type Variant = "default" | "outline" | "solid" | "surface";

export interface BadgeProps extends ViewProps {
  label: string;
  variant?: Variant;
  className?: string;
}

const CONTAINER: Record<Variant, string> = {
  default: "bg-muted",
  outline: "border-2 border-border bg-transparent",
  solid: "bg-foreground",
  surface: "border-2 border-border bg-primary",
};

const LABEL: Record<Variant, string> = {
  default: "text-muted-foreground",
  outline: "text-foreground",
  solid: "text-background",
  surface: "text-primary-foreground",
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
      <Text className={cn("text-xs font-semibold", LABEL[variant])}>
        {label}
      </Text>
    </View>
  );
}

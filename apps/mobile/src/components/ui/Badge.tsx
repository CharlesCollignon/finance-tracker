import { Text, View, type ViewProps } from "react-native";

import { cn } from "@/lib/cn";

type Variant = "default" | "outline" | "solid" | "surface";
type Size = "sm" | "md" | "lg";

export interface BadgeProps extends ViewProps {
  label: string;
  variant?: Variant;
  size?: Size;
  className?: string;
}

const CONTAINER: Record<Variant, string> = {
  default: "bg-muted rounded-md",
  outline: "border border-border bg-transparent rounded-md",
  solid: "bg-foreground rounded-md",
  surface: "bg-primary/15 rounded-md",
};

const LABEL: Record<Variant, string> = {
  default: "text-muted-foreground",
  outline: "text-foreground",
  solid: "text-background",
  surface: "text-primary-ink",
};

const PADDING: Record<Size, string> = {
  sm: "px-2 py-0.5",
  md: "px-2.5 py-1",
  lg: "px-3 py-1.5",
};

const LABEL_SIZE: Record<Size, string> = {
  sm: "text-xs",
  md: "text-xs",
  lg: "text-sm",
};

export function Badge({
  label,
  variant = "default",
  size = "md",
  className,
  ...props
}: BadgeProps) {
  return (
    <View
      className={cn("self-start", PADDING[size], CONTAINER[variant], className)}
      {...props}
    >
      <Text className={cn("font-medium", LABEL_SIZE[size], LABEL[variant])}>
        {label}
      </Text>
    </View>
  );
}

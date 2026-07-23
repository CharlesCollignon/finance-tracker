import { Pressable, Text, type PressableProps } from "react-native";

import { cn } from "@/lib/cn";
import { BRUTAL_SHADOW } from "@/theme/tokens";

type Variant = "default" | "secondary" | "outline" | "ghost";
type Size = "sm" | "md" | "lg";

export interface ButtonProps extends PressableProps {
  label: string;
  variant?: Variant;
  size?: Size;
  className?: string;
}

const CONTAINER: Record<Variant, string> = {
  default: "bg-primary border-2 border-border",
  secondary: "bg-secondary border-2 border-border",
  outline: "bg-transparent border-2 border-border",
  ghost: "bg-transparent",
};

const LABEL: Record<Variant, string> = {
  default: "text-primary-foreground",
  secondary: "text-secondary-foreground",
  outline: "text-foreground",
  ghost: "text-foreground",
};

const PADDING: Record<Size, string> = {
  sm: "px-3 py-1.5",
  md: "px-4 py-2.5",
  lg: "px-6 py-3.5",
};

const LABEL_SIZE: Record<Size, string> = {
  sm: "text-sm",
  md: "text-base",
  lg: "text-lg",
};

export function Button({
  label,
  variant = "default",
  size = "md",
  className,
  disabled,
  ...props
}: ButtonProps) {
  const hasShadow = variant !== "ghost";
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      style={hasShadow ? BRUTAL_SHADOW : undefined}
      className={cn(
        "items-center justify-center active:translate-x-[2px] active:translate-y-[2px]",
        CONTAINER[variant],
        PADDING[size],
        disabled && "opacity-60",
        className,
      )}
      {...props}
    >
      <Text
        className={cn("font-bold", LABEL[variant], LABEL_SIZE[size])}
      >
        {label}
      </Text>
    </Pressable>
  );
}

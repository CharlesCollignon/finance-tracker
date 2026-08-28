import { View, type ViewProps } from "react-native";

import { cn } from "@/lib/cn";

export interface CardProps extends ViewProps {
  className?: string;
  /** Double-bezel nested look: tinted outer shell around the real surface. */
  bezel?: boolean;
  innerClassName?: string;
}

export function Card({
  className,
  innerClassName,
  style,
  bezel,
  children,
  ...props
}: CardProps) {
  if (bezel) {
    return (
      <View
        style={style}
        className={cn(
          "rounded-[28px] border border-border bg-foreground/[0.04] p-1.5",
          className,
        )}
        {...props}
      >
        <View className={cn("rounded-[22px] bg-card p-4", innerClassName)}>
          {children}
        </View>
      </View>
    );
  }

  return (
    <View
      style={style}
      className={cn("rounded-lg border border-border bg-card p-4", className)}
      {...props}
    >
      {children}
    </View>
  );
}

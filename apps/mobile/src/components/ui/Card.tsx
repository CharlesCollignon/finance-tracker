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
          "rounded-[28px] border border-border bg-black/[0.03] p-1.5",
          "dark:border-border-dark dark:bg-white/[0.04]",
          className,
        )}
        {...props}
      >
        <View
          className={cn(
            "rounded-[22px] bg-card p-4",
            "dark:bg-card-dark",
            innerClassName,
          )}
        >
          {children}
        </View>
      </View>
    );
  }

  return (
    <View
      style={style}
      className={cn(
        "rounded-lg border border-border bg-card p-4",
        "dark:border-border-dark dark:bg-card-dark",
        className,
      )}
      {...props}
    >
      {children}
    </View>
  );
}

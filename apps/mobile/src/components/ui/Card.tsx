import { View, type ViewProps } from "react-native";

import { cn } from "@/lib/cn";

export interface CardProps extends ViewProps {
  className?: string;
  /** Double-bezel nested look: tinted outer shell around the real surface. */
  bezel?: boolean;
  innerClassName?: string;
}

/**
 * Surfaces are translucent now that there is something behind them.
 *
 * `bg-card` was opaque, which was right when the ground was a flat token
 * colour. With a bloom behind the whole app an opaque card is a hole punched
 * in it — so the fill drops to 70% and the border picks up a little light.
 * Not lower: the figures on these cards are the point of the screen, and text
 * over a gradient at high transparency is the easiest way to make an
 * interface look cheap.
 *
 * Deliberately a plain alpha rather than the native blur used elsewhere. A
 * blur view per card is real per-frame compositing on Android, and the thing
 * behind here is a soft gradient with nothing to blur.
 */
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
          "rounded-[28px] border border-foreground/10 bg-foreground/[0.06] p-1.5",
          className,
        )}
        {...props}
      >
        <View className={cn("rounded-[22px] bg-card/70 p-4", innerClassName)}>
          {children}
        </View>
      </View>
    );
  }

  return (
    <View
      style={style}
      className={cn(
        "rounded-2xl border border-foreground/10 bg-card/70 p-4",
        className,
      )}
      {...props}
    >
      {children}
    </View>
  );
}

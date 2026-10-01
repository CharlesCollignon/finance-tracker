import {
  Text as RNText,
  type TextProps as RNTextProps,
  type TextStyle,
} from "react-native";

import { cn } from "@/lib/cn";
import {
  hasTextColor,
  sansWeightFace,
  withoutTextColor,
} from "@/lib/text-class";
import { TABULAR, TYPE } from "@/theme/tokens";

type Variant =
  | "body"
  | "head"
  | "title"
  | "muted"
  | "label"
  | "amount"
  | "hero"
  | "figure"
  | "micro";

export interface TextProps extends RNTextProps {
  variant?: Variant;
  className?: string;
}

/*
 * Each variant sets exactly one text-size utility. Layering a second one at a
 * call site (className="text-lg" over a variant's text-base) leaves font size
 * and line height to resolve from different rules, which clipped the header
 * title on Android.
 */
const VARIANTS: Record<Variant, string> = {
  body: "font-sans text-base text-foreground",
  head: "font-sans text-base font-bold text-foreground",
  title: "font-sans text-2xl font-bold text-foreground",
  muted: "font-sans text-sm text-muted-foreground",
  label: "font-sans text-xs font-semibold uppercase text-muted-foreground",
  // The sans face with even-width digits, as on the web. It was IBM Plex
  // Mono, whose no-break space is three times as wide: "20  €".
  amount: "font-sans text-base text-foreground",
  // The display sizes carry no text-* class, and no font-* one either: size,
  // face, tracking and digit metric all arrive together from TYPE below —
  // for the lineHeight reason described there, and so that a figure cannot
  // end up with the size of a hero and the face of body copy.
  hero: "text-foreground",
  figure: "text-foreground",
  micro: "font-sans text-muted-foreground",
};

/**
 * Sizes that arrive as style rather than as a class, plus the digit metric.
 * A call site's own `style` still wins — it is applied after this one.
 */
const VARIANT_STYLE: Partial<Record<Variant, TextStyle>> = {
  hero: TYPE.hero,
  figure: TYPE.figure,
  micro: TYPE.micro,
  amount: TABULAR,
};

export function Text({
  variant = "body",
  className,
  style,
  numberOfLines,
  adjustsFontSizeToFit,
  ...props
}: TextProps) {
  // A colour on the call site must win over the variant's; NativeWind would
  // otherwise resolve the two by alphabetical order rather than by intent.
  const base = hasTextColor(className)
    ? withoutTextColor(VARIANTS[variant])
    : VARIANTS[variant];

  const classes = cn(base, className);
  // A figure is one line that shrinks to fit rather than a figure that
  // wraps ("1 281,84 / €"), unless the call site asks for something else.
  const display = variant === "hero" || variant === "figure";

  return (
    <RNText
      className={classes}
      style={[
        VARIANT_STYLE[variant],
        // `tabular-nums` as a class only reaches the web; native reads this.
        /(^|\s)tabular-nums(\s|$)/.test(classes) ? TABULAR : undefined,
        sansWeightFace(classes),
        style,
      ]}
      numberOfLines={numberOfLines ?? (display ? 1 : undefined)}
      adjustsFontSizeToFit={adjustsFontSizeToFit ?? display}
      minimumFontScale={display ? 0.6 : undefined}
      {...props}
    />
  );
}

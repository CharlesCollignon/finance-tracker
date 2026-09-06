import {
  Text as RNText,
  type TextProps as RNTextProps,
  type TextStyle,
} from "react-native";

import { cn } from "@/lib/cn";
import { hasTextColor, withoutTextColor } from "@/lib/text-class";
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
  amount: "font-mono text-base text-foreground",
  // The display sizes carry no text-* class: their size comes from TYPE
  // below, for the lineHeight reason described there.
  hero: "font-mono text-foreground",
  figure: "font-mono text-foreground",
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
  ...props
}: TextProps) {
  // A colour on the call site must win over the variant's; NativeWind would
  // otherwise resolve the two by alphabetical order rather than by intent.
  const base = hasTextColor(className)
    ? withoutTextColor(VARIANTS[variant])
    : VARIANTS[variant];

  return (
    <RNText
      className={cn(base, className)}
      style={[VARIANT_STYLE[variant], style]}
      {...props}
    />
  );
}

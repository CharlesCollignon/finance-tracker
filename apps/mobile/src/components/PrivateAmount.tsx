import { Text, type TextProps } from "react-native";

import { usePrivacy } from "@/providers/PrivacyProvider";
import { TABULAR } from "@/theme/tokens";
import { cn } from "@/lib/cn";
import { hasTextColor, sansWeightFace } from "@/lib/text-class";

interface PrivateAmountProps extends TextProps {
  children: string;
  className?: string;
}

/** Masks euro (and other) amounts when privacy mode is on. */
export function PrivateAmount({
  children,
  className,
  style,
  ...props
}: PrivateAmountProps) {
  const { hidden } = usePrivacy();
  // The sans face unless the call site names another, so an amount shown on
  // its own is never left in the system font; its weight class picks the file.
  const classes = cn(
    "font-sans tabular-nums",
    // Raw RN Text defaults to black, which is invisible in dark mode.
    hasTextColor(className) ? undefined : "text-foreground",
    className,
  );

  return (
    <Text
      // The class compiles to a var()-composed `font-variant-numeric`, which
      // is a web value; the style below is the one native reads. Both are
      // kept, since this renders under react-native-web too.
      style={[TABULAR, sansWeightFace(classes), style]}
      className={classes}
      {...props}
    >
      {hidden ? "••••••" : children}
    </Text>
  );
}

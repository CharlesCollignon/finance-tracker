import { Text, type TextProps } from "react-native";

import { usePrivacy } from "@/providers/PrivacyProvider";
import { TABULAR } from "@/theme/tokens";
import { cn } from "@/lib/cn";
import { hasTextColor } from "@/lib/text-class";

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

  return (
    <Text
      // The class compiles to a var()-composed `font-variant-numeric`, which
      // is a web value; the style below is the one native reads. Both are
      // kept, since this renders under react-native-web too.
      style={[TABULAR, style]}
      className={cn(
        "tabular-nums",
        // Raw RN Text defaults to black, which is invisible in dark mode.
        hasTextColor(className) ? undefined : "text-foreground",
        className,
      )}
      {...props}
    >
      {hidden ? "••••••" : children}
    </Text>
  );
}

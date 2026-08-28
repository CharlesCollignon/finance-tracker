import { Text, type TextProps } from "react-native";

import { usePrivacy } from "@/providers/PrivacyProvider";
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
  ...props
}: PrivateAmountProps) {
  const { hidden } = usePrivacy();

  return (
    <Text
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

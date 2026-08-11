import { Text, type TextProps } from "react-native";

import { usePrivacy } from "@/providers/PrivacyProvider";
import { cn } from "@/lib/cn";

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
    <Text className={cn("tabular-nums", className)} {...props}>
      {hidden ? "••••••" : children}
    </Text>
  );
}

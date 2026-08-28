import { View } from "react-native";

import { Text } from "@/components/ui/Text";
import { cn } from "@/lib/cn";

interface UserInitialProps {
  initial: string;
  className?: string;
  size?: "sm" | "md";
}

/** Round monogram chip, matching the web UserInitial. */
export function UserInitial({
  initial,
  className,
  size = "sm",
}: UserInitialProps) {
  const box = size === "sm" ? 24 : 28;

  return (
    <View
      className={cn(
        "items-center justify-center rounded-full bg-primary/20",
        className,
      )}
      style={{ width: box, height: box }}
    >
      <Text
        className={cn(
          "font-semibold text-primary",
          size === "sm" ? "text-[11px]" : "text-xs",
        )}
      >
        {initial}
      </Text>
    </View>
  );
}

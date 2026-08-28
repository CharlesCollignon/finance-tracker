import type { ReactNode } from "react";
import { View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { cn } from "@/lib/cn";
import { FadeIn } from "@/components/motion/FadeIn";
import { PrivacyToggle } from "@/components/PrivacyToggle";
import { Text } from "@/components/ui/Text";

export interface ScreenProps {
  title?: string;
  children?: ReactNode;
  className?: string;
  /** Show privacy eye on the right (default true when title set). */
  showPrivacyToggle?: boolean;
}

/**
 * Standard screen shell: safe-area padding, background, and an optional
 * page title with privacy toggle on the right.
 */
export function Screen({
  title,
  children,
  className,
  showPrivacyToggle = true,
}: ScreenProps) {
  return (
    <SafeAreaView
      edges={["top", "left", "right"]}
      className="flex-1 bg-background"
    >
      <FadeIn className={cn("flex-1 px-4 pt-2", className)}>
        {title ? (
          <View className="mb-4 flex-row items-center justify-between gap-3">
            <Text variant="title" className="flex-1">
              {title}
            </Text>
            {showPrivacyToggle ? <PrivacyToggle /> : null}
          </View>
        ) : showPrivacyToggle ? (
          <View className="mb-2 flex-row justify-end">
            <PrivacyToggle />
          </View>
        ) : null}
        <View className="flex-1">{children}</View>
      </FadeIn>
    </SafeAreaView>
  );
}

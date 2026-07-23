import type { ReactNode } from "react";
import { View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { cn } from "@/lib/cn";
import { Text } from "@/components/ui/Text";

export interface ScreenProps {
  title?: string;
  children?: ReactNode;
  className?: string;
}

/**
 * Standard screen shell: safe-area padding, background, and an optional
 * page title styled like the web PageHeader.
 */
export function Screen({ title, children, className }: ScreenProps) {
  return (
    <SafeAreaView edges={["top", "left", "right"]} className="flex-1 bg-background">
      <View className={cn("flex-1 px-4 pt-2", className)}>
        {title ? (
          <Text variant="title" className="mb-4">
            {title}
          </Text>
        ) : null}
        {children}
      </View>
    </SafeAreaView>
  );
}

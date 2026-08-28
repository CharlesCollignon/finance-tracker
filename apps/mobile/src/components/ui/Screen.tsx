import type { ReactNode } from "react";
import { View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { cn } from "@/lib/cn";
import { FadeIn } from "@/components/motion/FadeIn";
import { AccountMenu } from "@/components/layout/AccountMenu";
import { PrivacyToggle } from "@/components/PrivacyToggle";
import { Text } from "@/components/ui/Text";

export interface ScreenProps {
  title?: string;
  children?: ReactNode;
  className?: string;
  /** Extra controls in the header band, left of the privacy toggle. */
  headerActions?: ReactNode;
  /** Show privacy eye on the right (default true when title set). */
  showPrivacyToggle?: boolean;
  /** Account monogram sits right of the eye; off for the auth screens. */
  showAccountMenu?: boolean;
}

/**
 * Standard screen shell, mirroring the web PageHeader + PageContainer: a
 * bordered header band holding the page title and its actions, then the page
 * body. Title sizing follows the web header (text-lg) rather than a large
 * in-body heading, so both clients read the same way.
 */
export function Screen({
  title,
  children,
  className,
  headerActions,
  showPrivacyToggle = true,
  showAccountMenu = true,
}: ScreenProps) {
  const showHeader =
    Boolean(title) ||
    showPrivacyToggle ||
    showAccountMenu ||
    Boolean(headerActions);

  return (
    <SafeAreaView
      edges={["top", "left", "right"]}
      className="flex-1 bg-background"
    >
      {showHeader ? (
        <View className="min-h-[52px] flex-row items-center justify-between gap-3 border-b border-border px-4 py-2">
          <Text variant="heading" className="shrink-0" numberOfLines={1}>
            {title}
          </Text>
          <View className="min-w-0 shrink flex-row items-center justify-end gap-2">
            {headerActions}
            {showPrivacyToggle ? <PrivacyToggle /> : null}
            {showAccountMenu ? <AccountMenu /> : null}
          </View>
        </View>
      ) : null}
      <FadeIn className={cn("flex-1 px-4 py-4", className)}>{children}</FadeIn>
    </SafeAreaView>
  );
}

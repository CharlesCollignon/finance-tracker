import type { ReactNode } from "react";
import { View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { cn } from "@/lib/cn";
import { FadeIn } from "@/components/motion/FadeIn";
import { AccountMenu } from "@/components/layout/AccountMenu";
import { Logo } from "@/components/Logo";
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
  /** Centred mark; off for the auth screens, which show their own. */
  showLogo?: boolean;
}

const HEADER_HEIGHT = 56;

/**
 * Standard screen shell, mirroring the web PageHeader + PageContainer: title
 * on the left, mark centred, actions on the right, then the page body.
 *
 * The title sets its font size through `style` rather than a text-* class.
 * Tailwind's size utilities also set lineHeight, and on Android that clipped
 * the taller glyphs of this font; leaving lineHeight unset lets the platform
 * use the font's own metrics.
 */
export function Screen({
  title,
  children,
  className,
  headerActions,
  showPrivacyToggle = true,
  showAccountMenu = true,
  showLogo = true,
}: ScreenProps) {
  const showHeader =
    Boolean(title) ||
    showPrivacyToggle ||
    showAccountMenu ||
    showLogo ||
    Boolean(headerActions);

  return (
    <SafeAreaView
      edges={["top", "left", "right"]}
      className="flex-1 bg-background"
    >
      {showHeader ? (
        <View
          className="border-b border-border"
          style={{ height: HEADER_HEIGHT }}
        >
          <View className="flex-1 flex-row items-center justify-between gap-3 px-4">
            <View className="min-w-0 flex-1 flex-row items-center">
              <Text
                className="font-sans text-foreground"
                style={{ fontSize: 18 }}
                numberOfLines={1}
              >
                {title}
              </Text>
            </View>

            <View className="shrink-0 flex-row items-center gap-2">
              {headerActions}
              {showPrivacyToggle ? <PrivacyToggle /> : null}
              {showAccountMenu ? <AccountMenu /> : null}
            </View>
          </View>

          {/* Overlay, not a row child: as a sibling of the row it cannot take
              part in that row's layout and squeeze the title. */}
          {showLogo ? (
            <View
              pointerEvents="none"
              className="absolute inset-0 items-center justify-center"
            >
              <Logo size="sm" />
            </View>
          ) : null}
        </View>
      ) : null}
      <FadeIn className={cn("flex-1 px-4 py-4", className)}>{children}</FadeIn>
    </SafeAreaView>
  );
}

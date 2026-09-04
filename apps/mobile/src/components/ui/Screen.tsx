import type { ReactNode } from "react";
import { View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { cn } from "@/lib/cn";
import { AppBackdrop } from "@/components/AppBackdrop";
import { FadeIn } from "@/components/motion/FadeIn";
import { AccountMenu } from "@/components/layout/AccountMenu";
import { Logo } from "@/components/Logo";
import { PrivacyToggle } from "@/components/PrivacyToggle";
import { RefreshButton } from "@/components/RefreshButton";
import { Text } from "@/components/ui/Text";

export interface ScreenProps {
  title?: string;
  children?: ReactNode;
  className?: string;
  /** Extra controls in the header band, left of the privacy toggle. */
  headerActions?: ReactNode;
  /** Show privacy eye on the right (default true when title set). */
  showPrivacyToggle?: boolean;
  /**
   * Show the bank refresh on the right. On by default, and absent by itself
   * when there is nothing to refresh — no signed-in session, or a build with
   * no web app to ask through.
   */
  showRefresh?: boolean;
  /** Account monogram sits right of the eye; off for the auth screens. */
  showAccountMenu?: boolean;
  /** Centred mark; off for the auth screens, which show their own. */
  showLogo?: boolean;
}

const HEADER_HEIGHT = 56;

/**
 * Space held for the right-hand controls: refresh + eye + account, plus
 * breathing room. Reserved explicitly rather than measured, for the reason
 * the comment in the header explains — and it has to grow when a control is
 * added, or the title starts negotiating width with it again.
 */
const ACTIONS_WIDTH = 136;

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
  showRefresh = true,
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
      {/* First child, so everything below paints over it. */}
      <AppBackdrop />
      {showHeader ? (
        <View
          className="border-b border-border"
          style={{ height: HEADER_HEIGHT }}
        >
          {/*
            All three zones are positioned absolutely rather than laid out as a
            flex row. The title had been shrinking to a few characters on one
            screen and not others, which is what row negotiation does when some
            sibling reports an unexpected width. Reserving the actions' width
            explicitly takes that negotiation out of the picture entirely.
          */}
          <View
            className="absolute inset-y-0 left-4 justify-center"
            style={{ right: ACTIONS_WIDTH }}
          >
            <Text
              className="font-sans text-foreground"
              style={{ fontSize: 18 }}
              numberOfLines={1}
            >
              {title}
            </Text>
          </View>

          {showLogo ? (
            <View
              pointerEvents="none"
              className="absolute inset-0 items-center justify-center"
            >
              <Logo size="sm" />
            </View>
          ) : null}

          <View className="absolute inset-y-0 right-4 flex-row items-center gap-2">
            {headerActions}
            {showRefresh ? <RefreshButton /> : null}
            {showPrivacyToggle ? <PrivacyToggle /> : null}
            {showAccountMenu ? <AccountMenu /> : null}
          </View>
        </View>
      ) : null}
      <FadeIn className={cn("flex-1 px-4 py-4", className)}>{children}</FadeIn>
    </SafeAreaView>
  );
}

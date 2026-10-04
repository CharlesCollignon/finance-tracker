import type { ReactNode } from "react";
import { Pressable, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";

import { cn } from "@/lib/cn";
import { AppBackdrop, useSharedBackdrop } from "@/components/AppBackdrop";
import { FadeIn } from "@/components/motion/FadeIn";
import { AccountMenu } from "@/components/layout/AccountMenu";
import { Orb } from "@/components/Orb";
import { PrivacyToggle } from "@/components/PrivacyToggle";
import { RefreshButton } from "@/components/RefreshButton";
import { Text } from "@/components/ui/Text";
import { hapticLight } from "@/lib/haptics";
import { CHROME_MAX_FONT_SCALE, useChromeFontScale } from "@/theme/chrome";
import { ICON } from "@/theme/tokens";
import { useThemeColors } from "@/theme/useThemeColors";

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
  /** The orb beside the title; off for the auth screens, which show their own. */
  showLogo?: boolean;
  /**
   * A screen pushed over another: a back chevron where the orb sits, left of
   * the title, as a navigation bar puts it.
   */
  back?: { label: string; onPress: () => void };
}

/** At the system's default text size; it grows with the setting below. */
const HEADER_HEIGHT = 56;

const TITLE_SIZE = 18;

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
  back,
}: ScreenProps) {
  const colors = useThemeColors();
  // Under the tabs, the backdrop is the navigator's, drawn once.
  const sharedBackdrop = useSharedBackdrop();
  /*
   * The band is a fixed height holding text that the user can scale, so it
   * grows with the setting rather than cropping the title — the same bound the
   * tab bar uses. The title is capped to match; past that the band would eat
   * the screen to serve one line of chrome.
   */
  const fontScale = useChromeFontScale();
  const headerHeight = Math.round(HEADER_HEIGHT * fontScale);

  const showHeader =
    Boolean(title) ||
    Boolean(back) ||
    showPrivacyToggle ||
    showAccountMenu ||
    showLogo ||
    Boolean(headerActions);

  return (
    <SafeAreaView
      edges={["top", "left", "right"]}
      className={cn("flex-1", !sharedBackdrop && "bg-background")}
    >
      {/* First child, so everything below paints over it. */}
      {sharedBackdrop ? null : <AppBackdrop />}
      {showHeader ? (
        <View
          className="border-b border-border"
          style={{ height: headerHeight }}
        >
          {/*
            All three zones are positioned absolutely rather than laid out as a
            flex row. The title had been shrinking to a few characters on one
            screen and not others, which is what row negotiation does when some
            sibling reports an unexpected width. Reserving the actions' width
            explicitly takes that negotiation out of the picture entirely.
          */}
          {/* The orb, then the title, as on the web's header at phone
              width. The mark used to sit centred between the title and the
              actions, where it competed with both for the same band. */}
          <View
            className="absolute inset-y-0 left-4 flex-row items-center gap-2.5"
            style={{ right: ACTIONS_WIDTH }}
          >
            {back ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={back.label}
                hitSlop={12}
                onPress={() => {
                  void hapticLight();
                  back.onPress();
                }}
                className="-ml-1.5 h-9 w-9 items-center justify-center rounded-control"
              >
                <Ionicons
                  name="chevron-back"
                  size={ICON.xl}
                  color={colors.foreground}
                />
              </Pressable>
            ) : showLogo ? (
              <Orb size="sm" />
            ) : null}
            {/* A long name — a property's own — shrinks a little before it
                gives up its end. */}
            <Text
              className="min-w-0 shrink font-sans text-foreground"
              style={{ fontSize: TITLE_SIZE }}
              maxFontSizeMultiplier={CHROME_MAX_FONT_SCALE}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.8}
            >
              {title}
            </Text>
          </View>

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

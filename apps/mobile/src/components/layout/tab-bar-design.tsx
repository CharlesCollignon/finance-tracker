import { Ionicons } from "@expo/vector-icons";
import type { ComponentProps } from "react";
import { StyleSheet, Text, View, type ColorValue } from "react-native";
import type { Tabs } from "expo-router";
import type { Design } from "@finance/core/designs";

import { Blur } from "@/components/ui/Blur";
import { COLORS } from "@/theme/tokens";

type IoniconName = ComponentProps<typeof Ionicons>["name"];

/** The tab options `Tabs` takes, as an object (expo-router exports no name). */
type BottomTabNavigationOptions = Exclude<
  NonNullable<ComponentProps<typeof Tabs>["screenOptions"]>,
  (...args: never[]) => unknown
>;

/**
 * The tab bar in each design (`docs/plans/DESIGN_LAYOUTS_PLAN.md`, phase 7),
 * the phone's twin of the web's `components/layout/shells`:
 *
 * - « Nuit »: the glass bar docked to the edge, icons over labels.
 * - « Papier »: a ruled bar on the paper, the surfaces as words in the
 *   serif, no icons; the one you are in under a bar of the accent.
 * - « Bento »: a dark pill floating over the foot of the screen, icons only,
 *   the one you are in in a lighter disc.
 * - « Console »: square tabs numbered 1 to 6 in the mono face, the one you
 *   are in filled with the accent.
 *
 * All four draw the same tabs in the same order with the same dots; only
 * the drawing differs. Read while rendering: a change of design remounts
 * the navigator (`app/_layout.tsx`).
 */

/** « Bento »'s pill: its own dark ground, whatever the design's palette. */
const BENTO_PILL = "#0f1115";
const BENTO_LIT = "#2a2e37";
const BENTO_INK = "#ffffff";
const BENTO_QUIET = "#b4b9c4";

/** How far « Bento »'s pill floats above the bottom edge. */
export const BENTO_PILL_LIFT = 12;

interface BarContext {
  design: Design;
  barHeight: number;
  insetBottom: number;
}

/** The bar's own ground, frame and placement. */
export function barOptions({
  design,
  barHeight,
  insetBottom,
}: BarContext): Partial<BottomTabNavigationOptions> {
  const docked = {
    position: "absolute" as const,
    left: 0,
    right: 0,
    bottom: 0,
    height: barHeight + insetBottom,
    paddingBottom: insetBottom,
    backgroundColor: "transparent",
    elevation: 0,
    shadowOpacity: 0,
  };
  switch (design) {
    case "papier":
      return {
        tabBarBackground: () => (
          <View
            style={[
              StyleSheet.absoluteFill,
              { backgroundColor: COLORS.background },
            ]}
          />
        ),
        tabBarStyle: {
          ...docked,
          borderTopWidth: 1,
          borderTopColor: COLORS.foreground,
        },
        tabBarItemStyle: { paddingVertical: 0, paddingHorizontal: 2 },
      };
    case "bento":
      return {
        tabBarShowLabel: false,
        tabBarBackground: () => (
          <View
            style={[
              StyleSheet.absoluteFill,
              { backgroundColor: BENTO_PILL, borderRadius: 999 },
            ]}
          />
        ),
        tabBarStyle: {
          position: "absolute",
          left: 12,
          right: 12,
          bottom: insetBottom + BENTO_PILL_LIFT,
          height: barHeight + 8,
          paddingBottom: 0,
          borderRadius: 999,
          borderTopWidth: 0,
          backgroundColor: "transparent",
          elevation: 0,
          shadowOpacity: 0,
        },
        tabBarItemStyle: { paddingVertical: 4, paddingHorizontal: 0 },
      };
    case "console":
      return {
        tabBarBackground: () => (
          <View
            style={[
              StyleSheet.absoluteFill,
              { backgroundColor: COLORS.background },
            ]}
          />
        ),
        tabBarStyle: {
          ...docked,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: COLORS.hairlineStrong,
        },
        tabBarItemStyle: { paddingVertical: 0, paddingHorizontal: 0 },
      };
    default:
      return {
        tabBarBackground: () => <Blur style={StyleSheet.absoluteFill} />,
        tabBarStyle: {
          ...docked,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: COLORS.hairlineStrong,
        },
        tabBarItemStyle: { paddingVertical: 4, paddingHorizontal: 2 },
      };
  }
}

/** The extra each tab takes when it is the one you are in. */
export function litItemStyle(
  design: Design,
  lit: boolean,
): Partial<BottomTabNavigationOptions> {
  switch (design) {
    case "papier":
      return {
        tabBarItemStyle: {
          paddingVertical: 0,
          paddingHorizontal: 2,
          borderTopWidth: 3,
          borderTopColor: lit ? COLORS.primary : "transparent",
          marginTop: -1,
        },
      };
    case "console":
      return {
        tabBarItemStyle: {
          paddingVertical: 0,
          paddingHorizontal: 0,
          backgroundColor: lit ? COLORS.primary : "transparent",
        },
      };
    default:
      return {};
  }
}

/** The colour a tab's icon and label take. */
export function tabTint(design: Design, lit: boolean): string {
  switch (design) {
    case "bento":
      return lit ? BENTO_INK : BENTO_QUIET;
    case "console":
      return lit ? COLORS.primaryForeground : COLORS.mutedForeground;
    default:
      return lit ? COLORS.foreground : COLORS.mutedForeground;
  }
}

/** A tab's icon, or what stands in for it. */
export function TabIcon({
  design,
  lit,
  icon,
  iconInactive,
  number,
  size,
}: {
  design: Design;
  lit: boolean;
  icon: IoniconName;
  iconInactive: IoniconName;
  /** Its place in the bar, from 1: « Console » numbers its tabs. */
  number: number;
  size: number;
}) {
  const color = tabTint(design, lit);
  switch (design) {
    case "papier":
      // Words alone: a ledger draws no pictures.
      return null;
    case "console":
      return (
        <Text
          style={{
            color,
            fontFamily: "IBMPlexMono-Medium",
            fontSize: 12,
            fontVariant: ["tabular-nums"],
          }}
        >
          {number}
        </Text>
      );
    case "bento":
      return (
        <View
          style={{
            width: 48,
            height: 48,
            borderRadius: 999,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: lit ? BENTO_LIT : "transparent",
          }}
        >
          <Ionicons name={lit ? icon : iconInactive} size={22} color={color} />
        </View>
      );
    default:
      return (
        <Ionicons name={lit ? icon : iconInactive} size={size} color={color} />
      );
  }
}

/** A tab's label, in the design's face. */
export function TabLabel({
  design,
  color,
  lit,
  children,
}: {
  design: Design;
  color: ColorValue;
  lit: boolean;
  children: string;
}) {
  const face =
    design === "papier"
      ? { fontFamily: "Newsreader-SemiBold", fontSize: 14 }
      : design === "console"
        ? {
            fontFamily: "IBMPlexMono-Medium",
            fontSize: 9,
            textTransform: "uppercase" as const,
          }
        : { fontSize: 10, fontWeight: "500" as const };
  return (
    <Text
      numberOfLines={1}
      adjustsFontSizeToFit
      minimumFontScale={0.8}
      style={[
        { color },
        face,
        design === "papier" && !lit ? { opacity: 0.85 } : null,
      ]}
    >
      {children}
    </Text>
  );
}

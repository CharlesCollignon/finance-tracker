import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import type { ComponentProps } from "react";
import { StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTabBarHeight } from "@/theme/chrome";

import { Blur } from "@/components/ui/Blur";
import { QuickAddProvider } from "@/providers/QuickAddProvider";
import { ReminderProvider } from "@/providers/ReminderProvider";

import { useThemeColors } from "@/theme/useThemeColors";
import { useLedgerBadge } from "@/hooks/useLedgerBadge";
import { useT } from "@/providers/LocaleProvider";
import type { Key } from "@finance/core/i18n/t";

type IoniconName = ComponentProps<typeof Ionicons>["name"];

type TabConfig = {
  name: string;
  /** The message key for the tab's label, not the label. */
  titleKey: Key;
  icon: IoniconName;
  iconInactive: IoniconName;
};

/**
 * Five surfaces, mirroring APP_NAV_ITEMS on web.
 *
 * There were six, and one of them was not a destination: Calendar is the
 * Ledger seen by date, and it is now a view inside it — see SurfaceTabs.
 * Charges briefly went the same way, filed under Plan on the reasoning that a
 * standing charge is part of the plan. True about the data, wrong about the
 * use: it is the list people edit most often, and a tab away is the wrong
 * place for the app's most frequent destination. Profile lives in the header
 * account menu.
 *
 * Month is the newest one to leave the bar, and it left because the bar holds
 * five. The Bearing answers "where do I stand" across all of them, and every
 * one of its tiles links to the surface that explains its figure — so Month is
 * one press from the tile that states this month's, rather than a sixth
 * label squeezed into a row that already truncates on a small phone.
 */
const TABS: TabConfig[] = [
  {
    name: "index",
    titleKey: "nav.bearing",
    icon: "compass",
    iconInactive: "compass-outline",
  },
  {
    name: "transactions",
    titleKey: "nav.ledger",
    icon: "swap-horizontal",
    iconInactive: "swap-horizontal-outline",
  },
  {
    name: "recurring",
    titleKey: "nav.charges",
    icon: "repeat",
    iconInactive: "repeat-outline",
  },
  {
    name: "planning",
    titleKey: "nav.plan",
    icon: "flag",
    iconInactive: "flag-outline",
  },
  {
    name: "investments",
    titleKey: "nav.wallets",
    icon: "analytics",
    iconInactive: "analytics-outline",
  },
];

/*
 * Full-width bar on the bottom edge. Square corners, no inset. Its height now
 * comes from theme/chrome, which the screens also pad from, so the two cannot
 * drift apart.
 */
export default function TabsLayout() {
  const t = useT();
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const barHeight = useTabBarHeight();
  const waiting = useLedgerBadge();

  return (
    <ReminderProvider>
      <QuickAddProvider>
        <Tabs
          screenOptions={{
            headerShown: false,
            tabBarActiveTintColor: colors.primary,
            tabBarInactiveTintColor: colors.mutedForeground,
            tabBarLabelStyle: { fontSize: 10, fontWeight: "500" },
            tabBarItemStyle: { paddingVertical: 4, paddingHorizontal: 2 },
            // Blur only means something if content passes beneath the bar, so it
            // overlays rather than docks. Screens pad their scroll content to
            // clear it.
            tabBarBackground: () => <Blur style={StyleSheet.absoluteFill} />,
            tabBarStyle: {
              position: "absolute",
              left: 0,
              right: 0,
              bottom: 0,
              height: barHeight + insets.bottom,
              paddingBottom: insets.bottom,
              backgroundColor: "transparent",
              borderTopWidth: StyleSheet.hairlineWidth,
              borderTopColor: colors.border,
              elevation: 0,
              shadowOpacity: 0,
            },
            sceneStyle: { backgroundColor: colors.background },
          }}
        >
          {TABS.map(({ name, titleKey, icon, iconInactive }) => (
            <Tabs.Screen
              key={name}
              name={name}
              options={{
                title: t(titleKey),
                tabBarIcon: ({ focused, color, size }) => (
                  <Ionicons
                    name={focused ? icon : iconInactive}
                    size={size ?? 20}
                    color={color}
                  />
                ),
                // Both of the Ledger's open questions: charges the bank
                // looks to have already paid, and bank rows still waiting for
                // a category. A dot rather than a count: the bar is five
                // targets across a phone, and the numbers are on the Month
                // screen, one Needs you row each.
                ...(name === "transactions" && waiting > 0
                  ? {
                      tabBarBadge: "",
                      tabBarBadgeStyle: {
                        backgroundColor: colors.primary,
                        minWidth: 8,
                        maxWidth: 8,
                        height: 8,
                        borderRadius: 4,
                        transform: [{ translateX: -2 }, { translateY: 2 }],
                      },
                    }
                  : {}),
              }}
            />
          ))}
          {/* Reached from a Bearing tile, not the bar — see TABS above. */}
          <Tabs.Screen name="month" options={{ href: null }} />
          {/* A view of the Ledger, not a destination of its own. */}
          <Tabs.Screen name="calendar" options={{ href: null }} />
          {/* Reachable from the header account menu, not the tab bar. */}
          <Tabs.Screen name="profile" options={{ href: null }} />
        </Tabs>
      </QuickAddProvider>
    </ReminderProvider>
  );
}

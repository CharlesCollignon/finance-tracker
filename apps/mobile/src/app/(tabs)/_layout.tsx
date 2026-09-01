import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import type { ComponentProps } from "react";
import { StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Blur } from "@/components/ui/Blur";
import { QuickAddProvider } from "@/providers/QuickAddProvider";
import { ReminderProvider } from "@/providers/ReminderProvider";

import { useThemeColors } from "@/theme/useThemeColors";

type IoniconName = ComponentProps<typeof Ionicons>["name"];

type TabConfig = {
  name: string;
  title: string;
  icon: IoniconName;
  iconInactive: IoniconName;
};

/** Mirrors APP_NAV_ITEMS on web; Profile lives in the header account menu. */
const TABS: TabConfig[] = [
  {
    name: "index",
    title: "Home",
    icon: "pie-chart",
    iconInactive: "pie-chart-outline",
  },
  {
    name: "recurring",
    title: "Recurring",
    icon: "repeat",
    iconInactive: "repeat-outline",
  },
  {
    name: "transactions",
    title: "Transaction",
    icon: "swap-horizontal",
    iconInactive: "swap-horizontal-outline",
  },
  {
    name: "calendar",
    title: "Calendar",
    icon: "calendar",
    iconInactive: "calendar-outline",
  },
  {
    name: "investments",
    title: "Wallets",
    icon: "analytics",
    iconInactive: "analytics-outline",
  },
  {
    name: "planning",
    title: "Planning",
    icon: "flag",
    iconInactive: "flag-outline",
  },
];

/** Full-width bar on the bottom edge. Square corners, no inset. */
const BAR_HEIGHT = 60;

export default function TabsLayout() {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();

  return (
    <ReminderProvider>
      <QuickAddProvider>
        <Tabs
          screenOptions={{
            headerShown: false,
            tabBarActiveTintColor: colors.primary,
            tabBarInactiveTintColor: colors.mutedForeground,
            tabBarLabelStyle: { fontSize: 10, fontWeight: "500" },
            tabBarItemStyle: { paddingVertical: 4 },
            // Blur only means something if content passes beneath the bar, so it
            // overlays rather than docks. Screens pad their scroll content to
            // clear it.
            tabBarBackground: () => <Blur style={StyleSheet.absoluteFill} />,
            tabBarStyle: {
              position: "absolute",
              left: 0,
              right: 0,
              bottom: 0,
              height: BAR_HEIGHT + insets.bottom,
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
          {TABS.map(({ name, title, icon, iconInactive }) => (
            <Tabs.Screen
              key={name}
              name={name}
              options={{
                title,
                tabBarIcon: ({ focused, color, size }) => (
                  <Ionicons
                    name={focused ? icon : iconInactive}
                    size={size ?? 20}
                    color={color}
                  />
                ),
              }}
            />
          ))}
          {/* Reachable from the header account menu, not the tab bar. */}
          <Tabs.Screen name="profile" options={{ href: null }} />
        </Tabs>
      </QuickAddProvider>
    </ReminderProvider>
  );
}

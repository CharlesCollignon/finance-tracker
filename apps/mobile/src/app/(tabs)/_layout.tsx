import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { Tabs } from "expo-router";
import type { ComponentProps } from "react";
import { Platform, useColorScheme, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

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

/** Web nav geometry: 3.5rem tall, 0.75rem inset, full-radius pill. */
const BAR_HEIGHT = 56;
const BAR_INSET = 12;

export default function TabsLayout() {
  const scheme = useColorScheme();
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.mutedForeground,
        tabBarLabelStyle: { fontSize: 10, fontWeight: "500" },
        tabBarItemStyle: { borderRadius: 999, marginHorizontal: 2 },
        // The blur panel is the visible surface; the bar itself stays clear.
        tabBarBackground: () => (
          <BlurView
            intensity={Platform.OS === "android" ? 60 : 40}
            tint={scheme === "light" ? "light" : "dark"}
            style={{
              flex: 1,
              borderRadius: 999,
              overflow: "hidden",
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            {/* Android blur is weaker; a wash keeps the contrast web has. */}
            <View
              style={{
                flex: 1,
                backgroundColor:
                  scheme === "light"
                    ? "rgba(251,250,247,0.45)"
                    : "rgba(11,9,5,0.45)",
              }}
            />
          </BlurView>
        ),
        tabBarStyle: {
          position: "absolute",
          left: 16,
          right: 16,
          bottom: insets.bottom + BAR_INSET,
          height: BAR_HEIGHT,
          borderRadius: 999,
          backgroundColor: "transparent",
          borderTopWidth: 0,
          elevation: 0,
          shadowOpacity: 0,
        },
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
  );
}

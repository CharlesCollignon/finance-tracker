import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import type { ComponentProps } from "react";

import { COLORS } from "@/theme/tokens";

type IoniconName = ComponentProps<typeof Ionicons>["name"];

type TabConfig = {
  name: string;
  title: string;
  icon: IoniconName;
  iconInactive: IoniconName;
};

const TABS: TabConfig[] = [
  {
    name: "index",
    title: "Dashboard",
    icon: "pie-chart",
    iconInactive: "pie-chart-outline",
  },
  {
    name: "investments",
    title: "Wallets",
    icon: "analytics",
    iconInactive: "analytics-outline",
  },
  {
    name: "transactions",
    title: "Transactions",
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
    name: "recurring",
    title: "Recurring",
    icon: "repeat",
    iconInactive: "repeat-outline",
  },
  {
    name: "profile",
    title: "Profile",
    icon: "person",
    iconInactive: "person-outline",
  },
];

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: COLORS.foreground,
        tabBarInactiveTintColor: COLORS.mutedForeground,
        tabBarActiveBackgroundColor: COLORS.primary,
        tabBarInactiveBackgroundColor: COLORS.background,
        tabBarLabelStyle: { fontSize: 10, fontWeight: "600" },
        tabBarStyle: {
          backgroundColor: COLORS.background,
          borderTopWidth: 2,
          borderTopColor: COLORS.border,
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
                size={size ?? 22}
                color={color}
              />
            ),
          }}
        />
      ))}
    </Tabs>
  );
}

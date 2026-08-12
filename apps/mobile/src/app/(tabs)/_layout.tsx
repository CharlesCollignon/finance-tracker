import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import type { ComponentProps } from "react";
import { useColorScheme } from "react-native";

import { colorsForScheme } from "@/theme/tokens";

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
    title: "Home",
    icon: "pie-chart",
    iconInactive: "pie-chart-outline",
  },
  {
    name: "transactions",
    title: "Transaction",
    icon: "swap-horizontal",
    iconInactive: "swap-horizontal-outline",
  },
  {
    name: "recurring",
    title: "Recurring",
    icon: "repeat",
    iconInactive: "repeat-outline",
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
    name: "profile",
    title: "Profile",
    icon: "person",
    iconInactive: "person-outline",
  },
];

export default function TabsLayout() {
  const scheme = useColorScheme();
  const colors = colorsForScheme(scheme === "light" ? "light" : "dark");

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.mutedForeground,
        tabBarLabelStyle: { fontSize: 10, fontWeight: "500" },
        tabBarStyle: {
          backgroundColor: colors.background,
          borderTopWidth: 1,
          borderTopColor: colors.border,
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
      <Tabs.Screen
        name="planning"
        options={{
          href: null,
          title: "Planning",
        }}
      />
    </Tabs>
  );
}

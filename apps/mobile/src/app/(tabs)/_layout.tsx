import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import type { ComponentProps } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useThemeColors } from "@/theme/useThemeColors";

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
    name: "recurring",
    title: "Recurring",
    icon: "repeat",
    iconInactive: "repeat-outline",
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
  {
    name: "profile",
    title: "Profile",
    icon: "person",
    iconInactive: "person-outline",
  },
];

export default function TabsLayout() {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.mutedForeground,
        tabBarLabelStyle: { fontSize: 10, fontWeight: "500" },
        tabBarItemStyle: { borderRadius: 999 },
        tabBarStyle: {
          position: "absolute",
          left: 16,
          right: 16,
          bottom: insets.bottom + 8,
          height: 64,
          borderRadius: 999,
          backgroundColor: colors.card,
          borderWidth: 1,
          borderColor: colors.border,
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

import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { useRef, type ComponentProps } from "react";
import { StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { TAB_BAR_INSET, TAB_BAR_SIDE, useTabBarHeight } from "@/theme/chrome";

import { Blur } from "@/components/ui/Blur";
import { notifyDataChanged } from "@/lib/data-version";
import { MonthProvider } from "@/providers/MonthProvider";
import { QuickAddProvider } from "@/providers/QuickAddProvider";
import { ReminderProvider } from "@/providers/ReminderProvider";

import { useThemeColors } from "@/theme/useThemeColors";
import { useAppForeground } from "@/hooks/useAppForeground";
import { useLedgerBadge } from "@/hooks/useLedgerBadge";
import { useMonthFill } from "@/hooks/useMonthFill";
import { useT } from "@/providers/LocaleProvider";
import type { Key } from "@finance/core/i18n/t";
import { RADIUS } from "@/theme/tokens";

type IoniconName = ComponentProps<typeof Ionicons>["name"];

/**
 * How soon a second return counts as one. Long enough that flicking out to
 * copy an IBAN and back does not reload the screen twice; short enough that
 * someone who filed a row on the web and came straight back sees it.
 */
const RETURN_GAP_MS = 15_000;

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
 * Month left the bar for the same reason, then left the app entirely. It went
 * first because the bar holds five: the Bearing answers "where do I stand"
 * across all of them, and every one of its tiles was one press from the
 * surface that explained its figure. That surface is retired now — the press
 * opens a panel in place, on this tab, rather than navigating to a sixth
 * screen — so there is no `month` route left here to hide from the bar.
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
 * A glass pill floating above the bottom edge, as the web's bar is at phone
 * width — it was a full-width bar docked to the edge, with square corners.
 * Its height and inset come from theme/chrome, which the screens also pad
 * from, so the two cannot drift apart.
 */
export default function TabsLayout() {
  const t = useT();
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const barHeight = useTabBarHeight();
  const waiting = useLedgerBadge();
  // The month's charges, written in when the app opens — there is no Apply
  // button any more.
  useMonthFill();
  // Coming back to the app is coming back to figures that may have moved
  // while it was away: the bank's overnight sync, a row filed on the web,
  // a day gone by. Nothing here can know which, so the screen in view reads
  // everything again, and the others when they are next shown.
  const lastReturn = useRef(0);
  useAppForeground(() => {
    const now = Date.now();
    if (now - lastReturn.current >= RETURN_GAP_MS) {
      lastReturn.current = now;
      notifyDataChanged();
    }
  });

  return (
    <ReminderProvider>
      <MonthProvider>
        <QuickAddProvider>
          <Tabs
            screenOptions={{
              headerShown: false,
              // The active tab in foreground with its filled icon, as on the
              // web's bar; gold stays for the add button.
              tabBarActiveTintColor: colors.foreground,
              tabBarInactiveTintColor: colors.mutedForeground,
              tabBarLabelStyle: { fontSize: 10, fontWeight: "500" },
              tabBarItemStyle: { paddingVertical: 4, paddingHorizontal: 2 },
              // Blur only means something if content passes beneath the bar, so it
              // overlays rather than docks. Screens pad their scroll content to
              // clear it.
              tabBarBackground: () => (
                <Blur
                  style={[
                    StyleSheet.absoluteFill,
                    { borderRadius: RADIUS.pill, overflow: "hidden" },
                  ]}
                />
              ),
              tabBarStyle: {
                position: "absolute",
                left: TAB_BAR_SIDE,
                right: TAB_BAR_SIDE,
                bottom: insets.bottom + TAB_BAR_INSET,
                height: barHeight,
                paddingBottom: 0,
                borderRadius: RADIUS.pill,
                backgroundColor: "transparent",
                borderWidth: StyleSheet.hairlineWidth,
                borderTopWidth: StyleSheet.hairlineWidth,
                borderColor: colors.hairlineStrong,
                borderTopColor: colors.hairlineStrong,
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
                  // targets across a phone, and the numbers are on the Bearing,
                  // one panel each.
                  ...(name === "transactions" && waiting > 0
                    ? {
                        tabBarBadge: "",
                        tabBarBadgeStyle: {
                          backgroundColor: colors.foreground,
                          minWidth: 8,
                          maxWidth: 8,
                          height: 8,
                          borderRadius: RADIUS.pill,
                          transform: [{ translateX: -2 }, { translateY: 2 }],
                        },
                      }
                    : {}),
                }}
              />
            ))}
            {/* A view of the Ledger, not a destination of its own. */}
            <Tabs.Screen name="calendar" options={{ href: null }} />
            {/* And two of Placements: what the accounts earn, how the money
                is spread and what it costs; and what the funds are made of. */}
            <Tabs.Screen name="analysis" options={{ href: null }} />
            <Tabs.Screen name="look-through" options={{ href: null }} />
            {/* Reachable from the header account menu, not the tab bar. */}
            <Tabs.Screen name="profile" options={{ href: null }} />
          </Tabs>
        </QuickAddProvider>
      </MonthProvider>
    </ReminderProvider>
  );
}

import { Ionicons } from "@expo/vector-icons";
import { Tabs, usePathname } from "expo-router";
import { PlatformPressable } from "expo-router/react-navigation";
import { useEffect, useRef, type ComponentProps } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTabBarHeight } from "@/theme/chrome";

import { SharedBackdrop } from "@/components/AppBackdrop";
import { barTabOf } from "@/components/layout/SurfaceTabs";
import {
  barOptions,
  litItemStyle,
  TabIcon,
  TabLabel,
  tabTint,
} from "@/components/layout/tab-bar-design";
import { useDesign } from "@/providers/DesignProvider";
import { WhatsNewSheet } from "@/components/nouveautes/WhatsNewSheet";
import { notifyDataChanged } from "@/lib/data-version";
import { recordAppOpened } from "@/lib/mutations";
import { MonthProvider } from "@/providers/MonthProvider";
import { QuickAddProvider } from "@/providers/QuickAddProvider";
import { ReminderProvider } from "@/providers/ReminderProvider";

import { useThemeColors } from "@/theme/useThemeColors";
import { useAppForeground } from "@/hooks/useAppForeground";
import { useFlag } from "@/hooks/useFlag";
import { useOwner } from "@/providers/OwnerProvider";
import { useTabBadges } from "@/hooks/useTabBadges";
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
 * Four surfaces, mirroring APP_NAV_ITEMS on web, then Immobilier for an
 * account with `property.track` (see the `property` screen below), then
 * Plan (`PLAN_TAB`), last.
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
  // The Journal lands on its calendar (the owner's call, November 2026):
  // the list is the view one tab along, hidden from the bar below.
  {
    name: "calendar",
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
    name: "investments",
    titleKey: "nav.wallets",
    icon: "analytics",
    iconInactive: "analytics-outline",
  },
];

/**
 * Plan, last in the bar at the owner's ask (October 2026) — after Immobilier
 * when the account has it.
 */
const PLAN_TAB: TabConfig = {
  name: "planning",
  titleKey: "nav.plan",
  icon: "flag",
  iconInactive: "flag-outline",
};

/** The tabs that are a person's alone, hidden under « Commun ». */
const PERSONAL_TABS: ReadonlySet<string> = new Set(["planning", "investments"]);

const PROPERTY_TAB: TabConfig = {
  name: "property",
  titleKey: "nav.property",
  icon: "home",
  iconInactive: "home-outline",
};

/*
 * A glass pill floating above the bottom edge, as the web's bar is at phone
 * width — it was a full-width bar docked to the edge, with square corners.
 * Its height and inset come from theme/chrome, which the screens also pad
 * from, so the two cannot drift apart.
 */
export default function TabsLayout() {
  const t = useT();
  const colors = useThemeColors();
  // The bar's drawing (`tab-bar-design.tsx`); a change of design remounts
  // the navigator, so this is read again then.
  const { design } = useDesign();
  const insets = useSafeAreaInsets();
  const barHeight = useTabBarHeight();
  const badges = useTabBadges();
  const showProperty = useFlag("property.track");
  // Under « Commun », only the tabs a shared space has: no plan, no wallets
  // — those stay a person's.
  const { joint } = useOwner();
  // Which tab the screen in view belongs to. The bar's own `focused` is
  // true only for the route on screen, and the Ledger's and Placements'
  // other views are hidden routes, so it left the bar dark on them.
  const activeTab = barTabOf(usePathname());
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
      recordAppOpened();
    }
  });
  // And the first time the tabs are shown: opening the app from cold is not
  // a return to it.
  useEffect(() => {
    recordAppOpened();
  }, []);

  const tint = (lit: boolean) => tabTint(design, lit);
  // « Console » numbers its tabs: each one's place among those drawn.
  const shown = [
    "index",
    "calendar",
    "recurring",
    ...(joint ? [] : ["investments"]),
    ...(showProperty ? ["property"] : []),
    ...(joint ? [] : ["planning"]),
  ];
  const numberOf = (name: string) => shown.indexOf(name) + 1;
  // The dot on a tab with something waiting: the foreground on « Nuit »,
  // the accent on paper and black, lime on « Bento »'s dark pill.
  const dot =
    design === "bento"
      ? "#d4f25c"
      : design === "nuit"
        ? colors.foreground
        : colors.primary;
  // The label in the same colour as the icon, and the button saying it is
  // the selected one, both from `activeTab` rather than the route's focus.
  // A tab hidden from the bar (`href: null`) gets no button of its own:
  // expo-router draws none for it, and refuses one alongside `href`.
  const litWhen = (lit: boolean, hidden: boolean) => ({
    tabBarLabel: ({ children }: { children: string }) => (
      <TabLabel design={design} color={tint(lit)} lit={lit}>
        {children}
      </TabLabel>
    ),
    ...litItemStyle(design, lit),
    ...(hidden
      ? { href: null }
      : {
          tabBarButton: (props: ComponentProps<typeof PlatformPressable>) => (
            <PlatformPressable {...props} aria-selected={lit} />
          ),
        }),
  });

  // One surface of the bar. A function rather than a map, because Plan is
  // drawn after Immobilier, which is declared on its own below.
  const renderTab = ({ name, titleKey, icon, iconInactive }: TabConfig) => {
    const waiting =
      name === "index"
        ? badges.bearing
        : name === "calendar"
          ? badges.ledger
          : 0;
    return (
      <Tabs.Screen
        key={name}
        name={name}
        options={{
          title: t(titleKey),
          ...litWhen(activeTab === name, joint && PERSONAL_TABS.has(name)),
          tabBarIcon: ({ size }) => (
            <TabIcon
              design={design}
              lit={activeTab === name}
              icon={icon}
              iconInactive={iconInactive}
              number={numberOf(name)}
              size={size ?? 20}
            />
          ),
          // Each question where it is answered: charges the bank
          // looks to have already paid on Le point, bank rows still
          // waiting for a category on the Ledger. A dot rather than
          // a count: the bar is five targets across a phone, and the
          // numbers are on the screens themselves.
          ...(waiting > 0
            ? {
                tabBarBadge: "",
                tabBarBadgeStyle: {
                  backgroundColor: dot,
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
    );
  };

  return (
    <ReminderProvider>
      <MonthProvider>
        <QuickAddProvider>
          <SharedBackdrop>
            <Tabs
              screenOptions={{
                headerShown: false,
                // The active tab in its design's lit colour with its filled
                // icon, as on the web's bar; the accent stays for the add.
                tabBarActiveTintColor: tint(true),
                tabBarInactiveTintColor: tint(false),
                // Shrinks on one line rather than lose its end: see TabLabel.
                tabBarLabel: ({ color, children }) => (
                  <TabLabel design={design} color={color} lit={false}>
                    {children}
                  </TabLabel>
                ),
                // Over the content, never beside it: blur (« Nuit ») only
                // means something if content passes beneath the bar, so
                // screens pad their scroll content to clear it rather than the
                // bar taking room of its own. Its ground, frame and placement
                // are the design's (`tab-bar-design.tsx`).
                ...barOptions({
                  design,
                  barHeight,
                  insetBottom: insets.bottom,
                }),
                // Transparent over the one backdrop: see `SharedBackdrop`.
                sceneStyle: { backgroundColor: "transparent" },
              }}
            >
              {TABS.map(renderTab)}
              <Tabs.Screen
                name={PROPERTY_TAB.name}
                options={{
                  title: t(PROPERTY_TAB.titleKey),
                  // Not a tab at all without the flag, so the bar keeps five.
                  // A home owned together is the space's too (6c).
                  ...litWhen(activeTab === PROPERTY_TAB.name, !showProperty),
                  tabBarIcon: ({ size }) => (
                    <TabIcon
                      design={design}
                      lit={activeTab === PROPERTY_TAB.name}
                      icon={PROPERTY_TAB.icon}
                      iconInactive={PROPERTY_TAB.iconInactive}
                      number={numberOf(PROPERTY_TAB.name)}
                      size={size ?? 20}
                    />
                  ),
                }}
              />
              {renderTab(PLAN_TAB)}
              {/* Views of the Ledger, not destinations of their own. */}
              <Tabs.Screen name="transactions" options={{ href: null }} />
              <Tabs.Screen name="history" options={{ href: null }} />
              <Tabs.Screen name="merchants" options={{ href: null }} />
              {/* And two of Placements: what the accounts earn, how the money
                  is spread and what it costs; and what the funds are made of. */}
              <Tabs.Screen name="analysis" options={{ href: null }} />
              <Tabs.Screen name="look-through" options={{ href: null }} />
              {/* Reachable from the header account menu, not the tab bar. */}
              <Tabs.Screen name="profile" options={{ href: null }} />
            </Tabs>
            {/* Once, after the APK was updated: what it brought. */}
            <WhatsNewSheet />
          </SharedBackdrop>
        </QuickAddProvider>
      </MonthProvider>
    </ReminderProvider>
  );
}

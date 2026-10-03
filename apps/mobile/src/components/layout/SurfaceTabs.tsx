import { Pressable, View } from "react-native";
import { usePathname, useRouter, type Href } from "expo-router";

import { Text } from "@/components/ui/Text";
import { cn } from "@/lib/cn";
import { hapticLight } from "@/lib/haptics";
import { useT } from "@/providers/LocaleProvider";
import type { Key } from "@finance/core/i18n/t";

export interface SurfaceTab {
  href: Href;
  /** The message key for the tab's label, not the label. */
  labelKey: Key;
}

interface SurfaceTabsProps {
  tabs: SurfaceTab[];
  className?: string;
}

/**
 * Views within one surface.
 *
 * The tab bar had a slot for every way of looking at the same thing — a list,
 * a calendar, the charges behind them — which is six destinations for what is
 * really two. They are views, and views belong to the surface they show, not
 * to the bar along the bottom. Six became four this way, which is the
 * difference between a bar whose labels fit and one whose labels do not.
 *
 * Routes rather than local state, so each view keeps its own address and the
 * back gesture means what it says.
 */
export function SurfaceTabs({ tabs, className }: SurfaceTabsProps) {
  const t = useT();
  const pathname = usePathname();
  const router = useRouter();

  return (
    <View
      accessibilityRole="tablist"
      className={cn("flex-row items-center gap-1", className)}
    >
      {tabs.map((tab) => {
        const active = pathname === String(tab.href);
        return (
          <Pressable
            hitSlop={8}
            key={String(tab.href)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            onPress={() => {
              if (active) {
                return;
              }
              void hapticLight();
              router.replace(tab.href);
            }}
            className={cn(
              "rounded-full px-3.5 py-1.5",
              active ? "bg-foreground" : "bg-transparent",
            )}
          >
            <Text
              className={cn(
                "text-sm font-medium",
                active ? "text-background" : "text-muted-foreground",
              )}
            >
              {t(tab.labelKey)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** The Ledger's views: the same record, looked at three ways, as on the web. */
export const LEDGER_TABS: SurfaceTab[] = [
  { href: "/transactions", labelKey: "nav.ledgerList" },
  { href: "/calendar", labelKey: "nav.ledgerCalendar" },
  // Cast until the typed-routes list next regenerates with the new file.
  { href: "/history" as Href, labelKey: "nav.ledgerByCategory" },
];

/**
 * Placements' views: the accounts; what they earn, how the money is spread
 * and what it costs; and what the funds are made of. All live inside the
 * tabs, as the Ledger's do, so the tab bar stays on every one.
 */
export const WALLET_TABS: SurfaceTab[] = [
  { href: "/investments", labelKey: "nav.walletsPositions" },
  // Cast until the typed-routes list next regenerates with the new files.
  { href: "/analysis" as Href, labelKey: "nav.walletsAnalysis" },
  { href: "/look-through" as Href, labelKey: "nav.walletsLookThrough" },
];

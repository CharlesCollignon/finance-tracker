import { Pressable, View } from "react-native";
import { usePathname, useRouter, type Href } from "expo-router";

import { Text } from "@/components/ui/Text";
import { cn } from "@/lib/cn";
import { hapticLight } from "@/lib/haptics";

export interface SurfaceTab {
  href: Href;
  label: string;
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
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** The Ledger's views: the same record, looked at two ways. */
export const LEDGER_TABS: SurfaceTab[] = [
  { href: "/transactions", label: "List" },
  { href: "/calendar", label: "Calendar" },
];

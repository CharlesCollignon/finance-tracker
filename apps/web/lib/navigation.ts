import {
  ArrowsLeftRight,
  ChartLine,
  ChartPieSlice,
  Target,
  User,
} from "@phosphor-icons/react";

/**
 * The four surfaces.
 *
 * Organised by time rather than by table. The bank records what happened and
 * templates forecast what is coming, so the app already divides along that
 * line: Month is now, Ledger is the record, Plan is ahead, Wallets is what is
 * being built. Seven destinations became four, which is what let the phone bar
 * hold all of them.
 *
 * The paths are the old ones. Renaming them would have touched twenty-five
 * revalidation calls and the manifest to change strings nobody reads in an
 * installed app.
 */
export const APP_NAV_ITEMS = [
  { href: "/dashboard", label: "Month", icon: ChartPieSlice },
  { href: "/transactions", label: "Ledger", icon: ArrowsLeftRight },
  { href: "/budgets", label: "Plan", icon: Target },
  { href: "/investments", label: "Wallets", icon: ChartLine },
] as const;

export const PROFILE_NAV_ITEM = {
  href: "/profile",
  label: "Profile",
  icon: User,
} as const;

/**
 * The phone's bottom bar. Four destinations and the account trigger leave each
 * slot room for a legible label, which seven did not.
 */
export const BOTTOM_NAV_ITEMS = APP_NAV_ITEMS;

import {
  ArrowsLeftRight,
  CalendarBlank,
  ChartLine,
  ChartPieSlice,
  Repeat,
  User,
} from "@phosphor-icons/react";

/** Primary chrome (bottom nav + side nav main list). Profile lives
 * under the theme toggle in the SideNav footer. */
export const APP_NAV_ITEMS = [
  { href: "/dashboard", label: "Home", icon: ChartPieSlice },
  { href: "/transactions", label: "Transaction", icon: ArrowsLeftRight },
  { href: "/recurring", label: "Recurring", icon: Repeat },
  { href: "/calendar", label: "Calendar", icon: CalendarBlank },
  { href: "/investments", label: "Wallets", icon: ChartLine },
] as const;

export const PROFILE_NAV_ITEM = {
  href: "/profile",
  label: "Profile",
  icon: User,
} as const;

/** Bottom nav keeps Profile for thumb reach on mobile. */
export const BOTTOM_NAV_ITEMS = [...APP_NAV_ITEMS, PROFILE_NAV_ITEM] as const;

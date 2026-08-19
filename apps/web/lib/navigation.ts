import {
  ArrowsLeftRight,
  CalendarBlank,
  ChartLine,
  ChartPieSlice,
  Repeat,
  Target,
  User,
} from "@phosphor-icons/react";

/** Primary chrome (bottom nav + side nav main list). Profile opens
 * an account menu (theme, settings, sign out). */
export const APP_NAV_ITEMS = [
  { href: "/dashboard", label: "Home", icon: ChartPieSlice },
  { href: "/recurring", label: "Recurring", icon: Repeat },
  { href: "/transactions", label: "Transaction", icon: ArrowsLeftRight },
  { href: "/calendar", label: "Calendar", icon: CalendarBlank },
  { href: "/investments", label: "Wallets", icon: ChartLine },
  { href: "/budgets", label: "Planning", icon: Target },
] as const;

export const PROFILE_NAV_ITEM = {
  href: "/profile",
  label: "Profile",
  icon: User,
} as const;

/** Bottom nav keeps an account trigger for thumb reach on mobile. */
export const BOTTOM_NAV_ITEMS = [...APP_NAV_ITEMS, PROFILE_NAV_ITEM] as const;

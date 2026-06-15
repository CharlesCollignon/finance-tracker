import {
  ArrowsLeftRight,
  ChartPieSlice,
  Repeat,
  User,
} from "@phosphor-icons/react";

export const APP_NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: ChartPieSlice },
  { href: "/transactions", label: "Transactions", icon: ArrowsLeftRight },
  { href: "/recurring", label: "Recurring", icon: Repeat },
  { href: "/profile", label: "Profile", icon: User },
] as const;

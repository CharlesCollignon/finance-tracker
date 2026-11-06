"use client";

import { usePathname } from "next/navigation";
import type { Icon } from "@phosphor-icons/react";
import { activeNavHref, navItems } from "@/lib/navigation";
import { badgeFor, type NavBadges } from "@/lib/nav-badges";
import { useT } from "@/lib/locale-context";
import { useSpace } from "@/components/layout/SpaceContext";

export interface NavEntry {
  href: string;
  label: string;
  icon: Icon;
  active: boolean;
  /** Things waiting behind this surface; 0 for none. */
  waiting: number;
}

/**
 * The surfaces as every design's navigation draws them: the same list, the
 * same order, the same one lit, the same counts — so no design shows a
 * surface, a badge or an order the others do not. Only the drawing differs.
 */
export function useNavEntries(
  showProperty: boolean,
  badges: NavBadges,
): NavEntry[] {
  const t = useT();
  const pathname = usePathname();
  const here = activeNavHref(pathname);
  const joint = useSpace()?.joint ?? false;
  return navItems({ property: showProperty, joint }).map((item) => ({
    href: item.href,
    label: t(item.labelKey),
    icon: item.icon,
    active: here === item.href,
    waiting: badgeFor(item.href, badges),
  }));
}

/**
 * Whether to spell the palette's shortcut with a Command glyph: decided by
 * the keyboard in front of the reader, which the server cannot know.
 */
export function paletteShortcut(): string {
  if (typeof navigator === "undefined") {
    return "Ctrl K";
  }
  const platform =
    (navigator as { userAgentData?: { platform?: string } }).userAgentData
      ?.platform ?? navigator.platform;
  return /mac|iphone|ipad|ipod/i.test(platform) ? "⌘K" : "Ctrl K";
}

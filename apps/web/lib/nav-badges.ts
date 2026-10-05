/**
 * What is waiting behind a surface, for the dot or count on its tab. Each
 * question is badged where it is answered: « C'est arrivé ? » on the
 * Bearing, whose card asks it, and the bank rows waiting for a category on
 * the Ledger, whose review files them.
 *
 * Apart from `navigation.ts` because the shell, a server component, hands
 * these on: that module carries the surfaces' icons, which only load in a
 * client component.
 */
export interface NavBadges {
  bearing: number;
  ledger: number;
}

export const NO_BADGES: NavBadges = { bearing: 0, ledger: 0 };

/** How many things wait behind the surface at `href`. */
export function badgeFor(href: string, badges: NavBadges): number {
  return href === "/bearing"
    ? badges.bearing
    : href === "/transactions"
      ? badges.ledger
      : 0;
}

"use server";

import { getAuthUser } from "@/lib/auth/get-user";
import {
  getMonthAvailability,
  type MonthAvailability,
} from "@/lib/queries/month-availability";

/**
 * Which months of a year hold anything, for the grid to mark them.
 *
 * An action rather than data fetched with the page, because nothing needs it
 * until someone opens the grid — and when they do, they may page through
 * several years. Fetching every year up front would be work done for a
 * popover most visits never open.
 */
export async function getMonthAvailabilityAction(
  year: number,
): Promise<MonthAvailability | null> {
  const user = await getAuthUser();
  if (!user) {
    return null;
  }
  // Bounded before it reaches date arithmetic: the year arrives from a client
  // that can hold the year button down.
  if (!Number.isInteger(year) || year < 1970 || year > 2999) {
    return null;
  }

  try {
    return await getMonthAvailability(user.id, year);
  } catch {
    // The grid is still usable without the markers, and a failed decoration
    // must not stop someone changing month.
    return null;
  }
}

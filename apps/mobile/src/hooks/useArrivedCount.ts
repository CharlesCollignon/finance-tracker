import { useEffect, useState } from "react";

import { getCurrentMonth } from "@finance/core/constants";

import { countFulfilmentProposals } from "@/lib/queries";
import { useDataVersion } from "@/lib/data-version";
import { useAuth } from "@/providers/AuthProvider";

/**
 * How many charges are waiting to be confirmed, for the tab bar's badge.
 *
 * Always the month in progress. A question about a month that has ended is
 * not one the navigation should nag about, and the badge has no month picker
 * to disambiguate itself with.
 *
 * Re-read on `useDataVersion`, which is what every screen already uses to
 * notice a write that happened somewhere else — so answering a question on
 * the Month screen clears the badge without the bar knowing why.
 */
export function useArrivedCount(): number {
  // The id rather than the user object, so the guard and the dependency list
  // name the same thing and the effect does not re-run on an identical user.
  const userId = useAuth().user?.id;
  const dataVersion = useDataVersion();
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!userId) {
      return;
    }

    let cancelled = false;
    const now = getCurrentMonth();

    countFulfilmentProposals(userId, now.year, now.month)
      .then((next) => {
        if (!cancelled) {
          setCount(next);
        }
      })
      // A badge is not worth an error. Nothing shown is the right failure:
      // the Month screen asks the same question on every visit.
      .catch(() => {
        if (!cancelled) {
          setCount(0);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [userId, dataVersion]);

  return count;
}

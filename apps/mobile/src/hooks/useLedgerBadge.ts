import { useEffect, useState } from "react";

import { getCurrentMonth } from "@finance/core/constants";

import { countFulfilmentProposals, countPendingFeedItems } from "@/lib/queries";
import { useDataVersion } from "@/lib/data-version";
import { useAuth } from "@/providers/AuthProvider";

/**
 * How many things are waiting behind the Ledger tab.
 *
 * Two questions land there, and the bar should light up for either. A charge
 * the bank looks to have already paid needs confirming; a bank row with no
 * category needs filing. This counted only the first, so an inbox the
 * overnight sync had filled with six entries left the tab bar looking exactly
 * as it does on a quiet day — which was the whole problem: nothing anywhere
 * on the phone said the review existed.
 *
 * Fulfilments are asked about the month in progress only. A question about a
 * month that has ended is not one the navigation should nag about, and the
 * badge has no month picker to disambiguate itself with. The inbox is not
 * month-scoped at all: it is a queue of decisions, and a coffee from the 29th
 * of last month still needs a category.
 *
 * Re-read on `useDataVersion`, which is what every screen already uses to
 * notice a write that happened somewhere else — so answering a question in
 * the inbox clears the badge without the bar knowing why.
 */
export function useLedgerBadge(): number {
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

    // Settled rather than awaited together: one of these failing should cost
    // its own half of the count, not the whole badge.
    void Promise.allSettled([
      countFulfilmentProposals(userId, now.year, now.month),
      countPendingFeedItems(userId),
    ]).then((results) => {
      if (cancelled) {
        return;
      }
      setCount(
        results.reduce(
          (total, result) =>
            total + (result.status === "fulfilled" ? result.value : 0),
          0,
        ),
      );
    });

    return () => {
      cancelled = true;
    };
  }, [userId, dataVersion]);

  return count;
}

import { useEffect, useState } from "react";

import { getCurrentMonth } from "@finance/core/constants";

import { countFulfilmentProposals, countPendingFeedItems } from "@/lib/queries";
import { useDataVersion } from "@/lib/data-version";
import { useOwner } from "@/providers/OwnerProvider";

/** What the two counts are drawn from. */
const BADGE_READS = ["transactions", "templates", "bank"] as const;

/** How many things wait behind Le point and behind the Ledger. */
export interface TabBadges {
  bearing: number;
  ledger: number;
}

const NONE: TabBadges = { bearing: 0, ledger: 0 };

/**
 * What is waiting behind the tabs, each question badged where it is
 * answered, as on the web.
 *
 * A charge the bank looks to have already paid needs confirming, and Le
 * point's card is where « C'est arrivé ? » is asked: its tab lights up for
 * it. It used to light the Ledger's, which showed the row with a dot and
 * nowhere to answer. A bank row with no category needs filing, in the
 * Ledger's review: its tab lights up for that.
 *
 * Fulfilments are asked about the month in progress only. A question about a
 * month that has ended is not one the navigation should nag about, and the
 * badge has no month picker to disambiguate itself with. The inbox is not
 * month-scoped at all: it is a queue of decisions, and a coffee from the 29th
 * of last month still needs a category.
 *
 * Re-read whenever the ledger, the charges or the bank's rows change, which
 * is how every screen notices a write that happened somewhere else — so
 * answering a question clears its badge without the bar knowing why.
 */
export function useTabBadges(): TabBadges {
  // The id rather than the user object, so the guard and the dependency list
  // name the same thing and the effect does not re-run on an identical user.
  const userId = useOwner().ownerId;
  const dataVersion = useDataVersion(BADGE_READS);
  const [badges, setBadges] = useState<TabBadges>(NONE);

  useEffect(() => {
    if (!userId) {
      return;
    }

    let cancelled = false;
    const now = getCurrentMonth();

    // Settled rather than awaited together: one of these failing should cost
    // its own badge, not both.
    void Promise.allSettled([
      countFulfilmentProposals(userId, now.year, now.month),
      countPendingFeedItems(userId),
    ]).then(([arrived, inbox]) => {
      if (cancelled) {
        return;
      }
      setBadges({
        bearing: arrived.status === "fulfilled" ? arrived.value : 0,
        ledger: inbox.status === "fulfilled" ? inbox.value : 0,
      });
    });

    return () => {
      cancelled = true;
    };
  }, [userId, dataVersion]);

  return badges;
}

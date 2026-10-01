import { useEffect } from "react";
import * as Notifications from "expo-notifications";
import { useRouter, type Href } from "expo-router";

import { mobileRouteForPushUrl } from "@finance/core/push-routes";

import { notifyDataChanged } from "@/lib/data-version";
import { stampReviewAsk } from "@/lib/review-ask";

/**
 * Takes the user where a tapped notification pointed.
 *
 * The payload carries a web path, because one digest is written for every
 * device and the daily job that writes it runs in the web app. Translating it
 * is `@finance/core/push-routes`, which lives next to the digest that writes
 * those paths so a route renamed on one side and not the other is a failing
 * test rather than a notification that opens the wrong screen. This is only
 * the part that needs a router.
 *
 * The query survives the translation, which is the point of doing it at all:
 * `/transactions?review=inbox` is what makes a tapped "6 entries need a
 * category" open the review rather than the Ledger it happens to live on.
 *
 * `useLastNotificationResponse` reports the tap that launched the app from
 * cold as well as one that arrived while it was running, which is the case
 * that matters: the notification is read on a lock screen, and by the time
 * the app is up the reason for opening it has to still be there.
 *
 * A push is also news that the figures moved — the server sends one only when
 * something happened — so arriving or tapped, every screen reads again:
 * landing on the Journal for "6 entries need a category" onto an inbox read
 * an hour before the sync filled it would be landing nowhere. A charge
 * reminder arriving costs the same one reload, which is cheaper than telling
 * the two apart.
 */
export function useNotificationRouting(ready: boolean): void {
  const response = Notifications.useLastNotificationResponse();
  const router = useRouter();

  useEffect(() => {
    const subscription = Notifications.addNotificationReceivedListener(() =>
      notifyDataChanged(),
    );
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (!ready || !response) {
      return;
    }

    const { url } = response.notification.request.content.data ?? {};
    const route = mobileRouteForPushUrl(url);
    notifyDataChanged();

    // The Bearing when the path cannot be placed — a web-only surface such
    // as /history, or a payload from a build older than the route it names.
    // Opening the app somewhere plausible is a small failure; pushing a route
    // the navigator has never heard of is a crash. A review asked for is
    // stamped, so it opens even on a Journal where it was closed earlier
    // (`lib/review-ask.ts`).
    router.push(
      (route === null
        ? "/"
        : Object.keys(route.params).length > 0
          ? { pathname: route.pathname, params: stampReviewAsk(route.params) }
          : route.pathname) as Href,
    );

    // Cleared once acted on, or the same tap would navigate again on the next
    // render that happens to re-run this — and pinning the user to one screen
    // is a strange thing for a notification to do an hour later.
    //
    // The sync one, not `clearLastNotificationResponseAsync`: the installed
    // expo-notifications marks the async version deprecated in favour of
    // this, which is the reverse of what the published SDK 57 doc page says.
    Notifications.clearLastNotificationResponse();
  }, [ready, response, router]);
}

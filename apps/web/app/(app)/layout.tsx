import type { ReactNode } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { LiveRefresh } from "@/components/layout/LiveRefresh";
import { MonthFill } from "@/components/layout/MonthFill";
import { OutboxBanner } from "@/components/layout/OutboxBanner";
import { QuickAddProvider } from "@/components/layout/QuickAddProvider";
import { RefreshProvider } from "@/components/layout/RefreshProvider";
import { ServiceWorkerRegistration } from "@/components/layout/ServiceWorkerRegistration";
import { ToastProvider } from "@/components/layout/ToastProvider";
import { getAuthUser } from "@/lib/auth/get-user";
import { getQuickEntryContext } from "@/lib/queries/quick-entry";
import { accountLabel } from "@/lib/account-label";
import { bankFeedBelongsTo } from "@/lib/bank/client";
import { countFulfilmentProposals } from "@/lib/queries/fulfilment";
import { getRecurringTemplates } from "@/lib/queries/finance";
import { getCurrentMonth } from "@finance/core/constants";
import type { PullFreshness } from "@finance/core/bank-pull";
import { readPullFreshness } from "@/lib/bank/pull";
import { createClient } from "@/lib/supabase/server";
import { getLocale } from "@/lib/locale";
import { getFlags } from "@/lib/flags";
import { isFlagOn } from "@finance/core/flags";

const NO_QUICK_ENTRY = {
  categories: [],
  recentCategoryIds: [],
  merchants: [],
} satisfies Awaited<ReturnType<typeof getQuickEntryContext>>;

export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await getAuthUser();
  const { name, initial } = accountLabel(user ?? {});

  // Two stages rather than six reads in a row. This layout renders again
  // after every write, before the page's own reads start, so each read here
  // that waited on the one before was a delay every save paid.
  const [connected, quickEntry, templates, flags] = user
    ? await Promise.all([
        // Per user, not per deployment. This flag decides what the refresh
        // control promises, and the action behind it gates on whether *this*
        // user has a bank — so a deployment-wide answer here is what let the
        // button offer to ask your bank and then report back without having
        // asked anything.
        bankFeedBelongsTo(user.id),
        // Fetched here rather than per page so the quick-add sheet —
        // reachable from every screen — opens with no loading state.
        getQuickEntryContext(user.id),
        // Only for the badge below, which is not worth the whole shell.
        getRecurringTemplates(user.id).catch(() => null),
        // Which surfaces the bars draw.
        getFlags(),
      ])
    : [false, NO_QUICK_ENTRY, null, null];

  const [freshness, arrivedCount] = await Promise.all([
    // One small read for a control on every surface, and only where there is
    // a bank for it to describe. A failure here would take down every app
    // page to report the age of a figure, which is a poor trade: the control
    // falls back to saying nothing about freshness.
    user && connected
      ? createClient()
          .then(async (supabase) =>
            readPullFreshness(supabase, user.id, await getLocale()),
          )
          .catch((): PullFreshness | null => null)
      : null,
    // Charges the bank looks to have already paid, for a badge on the Ledger.
    // Always this month: a question about a month that has ended is not one
    // the nav should be nagging about.
    user && templates
      ? countFulfilmentProposals(
          user.id,
          templates,
          quickEntry.categories,
          getCurrentMonth().year,
          getCurrentMonth().month,
        ).catch(() => 0)
      : 0,
  ]);

  // Different on every render, which is the point: `LiveRefresh` tells a
  // render it asked for from one a write caused. A server component renders
  // once per request, so the purity rule's concern — a value that changes
  // between re-renders of the same tree — is the behaviour wanted here.
  // eslint-disable-next-line react-hooks/purity
  const renderedAt = Date.now();

  return (
    <ToastProvider>
      <RefreshProvider initial={freshness} connected={connected}>
        <QuickAddProvider
          categories={quickEntry.categories}
          recentCategoryIds={quickEntry.recentCategoryIds}
          merchants={quickEntry.merchants}
        >
          <ServiceWorkerRegistration />
          {user ? <MonthFill /> : null}
          {user ? <LiveRefresh renderedAt={renderedAt} /> : null}
          <OutboxBanner />
          <AppShell
            displayName={name}
            initial={initial}
            ledgerBadge={arrivedCount}
            showProperty={flags ? isFlagOn(flags, "property.track") : false}
          >
            {children}
          </AppShell>
        </QuickAddProvider>
      </RefreshProvider>
    </ToastProvider>
  );
}

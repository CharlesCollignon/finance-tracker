import type { ReactNode } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { OutboxBanner } from "@/components/layout/OutboxBanner";
import { QuickAddProvider } from "@/components/layout/QuickAddProvider";
import { RefreshProvider } from "@/components/layout/RefreshProvider";
import { ServiceWorkerRegistration } from "@/components/layout/ServiceWorkerRegistration";
import { ToastProvider } from "@/components/layout/ToastProvider";
import { getAuthUser } from "@/lib/auth/get-user";
import { getQuickEntryContext } from "@/lib/queries/quick-entry";
import { accountLabel } from "@/lib/account-label";
import { bankFeedConfigured } from "@/lib/bank/client";
import { countFulfilmentProposals } from "@/lib/queries/fulfilment";
import { getRecurringTemplates } from "@/lib/queries/finance";
import { getCurrentMonth } from "@finance/core/constants";
import type { PullFreshness } from "@finance/core/bank-pull";
import { readPullFreshness } from "@/lib/bank/pull";
import { createClient } from "@/lib/supabase/server";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await getAuthUser();
  const { name, initial } = accountLabel(user ?? {});
  const connected = bankFeedConfigured();

  // Fetched here rather than per page so the quick-add sheet — reachable from
  // every screen — opens with no loading state.
  const quickEntry = user
    ? await getQuickEntryContext(user.id)
    : { categories: [], tags: [], recentCategoryIds: [], merchants: [] };

  // One small read for a control on every surface, and only where there is a
  // bank for it to describe. A failure here would take down every app page to
  // report the age of a figure, which is a poor trade: the control falls back
  // to saying nothing about freshness.
  let freshness: PullFreshness | null = null;
  if (user && connected) {
    try {
      freshness = await readPullFreshness(await createClient(), user.id);
    } catch {
      freshness = null;
    }
  }

  // Charges the bank looks to have already paid, for a badge on the Ledger.
  // Always this month: a question about a month that has ended is not one the
  // nav should be nagging about. Wrapped, because a badge is not worth the
  // whole shell.
  let arrivedCount = 0;
  if (user) {
    try {
      const now = getCurrentMonth();
      arrivedCount = await countFulfilmentProposals(
        user.id,
        await getRecurringTemplates(user.id),
        quickEntry.categories,
        now.year,
        now.month,
      );
    } catch {
      arrivedCount = 0;
    }
  }

  return (
    <ToastProvider>
      <RefreshProvider initial={freshness} connected={connected}>
        <QuickAddProvider
          categories={quickEntry.categories}
          tags={quickEntry.tags}
          recentCategoryIds={quickEntry.recentCategoryIds}
          merchants={quickEntry.merchants}
        >
          <ServiceWorkerRegistration />
          <OutboxBanner />
          <AppShell
            displayName={name}
            initial={initial}
            ledgerBadge={arrivedCount}
          >
            {children}
          </AppShell>
        </QuickAddProvider>
      </RefreshProvider>
    </ToastProvider>
  );
}

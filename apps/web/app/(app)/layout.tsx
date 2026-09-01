import type { ReactNode } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { OutboxBanner } from "@/components/layout/OutboxBanner";
import { QuickAddProvider } from "@/components/layout/QuickAddProvider";
import { ServiceWorkerRegistration } from "@/components/layout/ServiceWorkerRegistration";
import { ToastProvider } from "@/components/layout/ToastProvider";
import { getAuthUser } from "@/lib/auth/get-user";
import { getQuickEntryContext } from "@/lib/queries/quick-entry";
import { accountLabel } from "@/lib/account-label";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await getAuthUser();
  const { name, initial } = accountLabel(user ?? {});

  // Fetched here rather than per page so the quick-add sheet — reachable from
  // every screen — opens with no loading state.
  const quickEntry = user
    ? await getQuickEntryContext(user.id)
    : { categories: [], tags: [], recentCategoryIds: [], merchants: [] };

  return (
    <ToastProvider>
      <QuickAddProvider
        categories={quickEntry.categories}
        tags={quickEntry.tags}
        recentCategoryIds={quickEntry.recentCategoryIds}
        merchants={quickEntry.merchants}
      >
        <ServiceWorkerRegistration />
        <OutboxBanner />
        <AppShell displayName={name} initial={initial}>
          {children}
        </AppShell>
      </QuickAddProvider>
    </ToastProvider>
  );
}

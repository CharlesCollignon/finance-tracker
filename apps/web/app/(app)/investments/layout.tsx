import type { ReactNode } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { PageContainer } from "@/components/layout/PageContainer";
import { SurfaceTabs, WALLET_TABS } from "@/components/layout/SurfaceTabs";
import { RefreshQuotesButton } from "@/components/finance/RefreshQuotesButton";

/**
 * Placements' three views — the accounts, the analysis, what the funds are
 * made of — under one header and one strip of tabs, drawn once: switching
 * views keeps them where they are, and only the view below them loads.
 * Nothing is read here, so a navigation never waits on the layout.
 *
 * The tab strip belongs on every view — without it the look-through was
 * reachable only from the sidebar, which is hidden on a phone.
 */
export default function InvestmentsLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <>
      <PageHeader titleKey="nav.wallets" />
      <PageContainer>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <SurfaceTabs tabs={WALLET_TABS} />
          <RefreshQuotesButton />
        </div>
        {children}
      </PageContainer>
    </>
  );
}

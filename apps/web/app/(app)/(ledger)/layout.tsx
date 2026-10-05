import type { ReactNode } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { PageContainer } from "@/components/layout/PageContainer";
import { LedgerToolbar } from "@/components/layout/LedgerToolbar";

/**
 * The Ledger's three views — the list, the calendar, By category — under one
 * header and one toolbar, drawn once: switching views keeps them where they
 * are, and only the view below them loads. Nothing is read here, so a
 * navigation never waits on the layout (see `loading.js` in the Next docs).
 */
export default function LedgerLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <PageHeader titleKey="nav.ledger" />
      <PageContainer>
        <LedgerToolbar />
        {children}
      </PageContainer>
    </>
  );
}

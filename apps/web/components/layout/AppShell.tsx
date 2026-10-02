import type { ReactNode } from "react";
import { AccountLabelProvider } from "@/components/layout/AccountLabel";
import { AppBackdrop } from "@/components/layout/AppBackdrop";
import { TopNav } from "@/components/layout/TopNav";
import { BottomNav } from "@/components/layout/BottomNav";
import { PageEnter } from "@/components/motion/PageEnter";
import { SHELL_MAIN_PADDING_BOTTOM } from "@/lib/layout-shell";
import { cn } from "@/lib/utils";

interface AppShellProps {
  children: ReactNode;
  displayName: string;
  initial: string;
  /** How many charges are waiting to be confirmed, for the Ledger's badge. */
  ledgerBadge?: number;
}

export function AppShell({
  children,
  displayName,
  initial,
  ledgerBadge = 0,
}: AppShellProps) {
  return (
    <AccountLabelProvider displayName={displayName} initial={initial}>
      <div className="flex min-h-screen flex-col">
        {/* Outside the scrolling column and fixed to the viewport, so the veil
          stays put while content moves over it. */}
        <AppBackdrop />
        <TopNav
          displayName={displayName}
          initial={initial}
          ledgerBadge={ledgerBadge}
        />
        {/* From `md` the notch and the bar either side of it are fixed over the
          page, not in its flow, so the page starts a bezel and a notch down
          to begin below them. */}
        <div
          className={cn(
            "flex min-w-0 flex-1 flex-col",
            "md:pt-[calc(var(--shell-frame)+var(--shell-notch-height))]",
            SHELL_MAIN_PADDING_BOTTOM,
          )}
        >
          {/* Transparent rather than `bg-background`, so the veil shows
            through. There used to be a hairline down its left edge, the seam
            with the side rail; the rail is the top bar now and there is no
            seam to draw.

            `min-w-0` because a flex item defaults to `min-width: auto` and
            so cannot shrink below the intrinsic width of its widest child.
            Nothing overflows today, but the header band this pane contains
            now holds a title, a month picker, a refresh, a privacy toggle and
            the account menu, and the failure mode is not local: the pane would grow to fit the
            band, the document would grow with the pane, and every card on
            every page would inherit the overflow through its own `w-full`. */}
          <main className="flex min-h-0 min-w-0 flex-1 flex-col">
            <PageEnter>{children}</PageEnter>
          </main>
        </div>
        <BottomNav ledgerBadge={ledgerBadge} />
      </div>
    </AccountLabelProvider>
  );
}

import type { ReactNode } from "react";
import { AppBackdrop } from "@/components/layout/AppBackdrop";
import { SideNav } from "@/components/layout/SideNav";
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
    <div className="flex min-h-screen">
      {/* Outside the scrolling column and fixed to the viewport, so the veil
          stays put while content moves over it. */}
      <AppBackdrop />
      <SideNav
        displayName={displayName}
        initial={initial}
        ledgerBadge={ledgerBadge}
      />
      <div
        className={cn(
          "flex min-h-screen min-w-0 flex-1 flex-col",
          SHELL_MAIN_PADDING_BOTTOM,
        )}
      >
        {/* Transparent rather than `bg-background`: the panes used to paint
            over each other to hide the layout seams, which would now paint
            over the veil as well. The seam is a hairline border instead.

            `min-w-0` because a flex item defaults to `min-width: auto` and
            so cannot shrink below the intrinsic width of its widest child.
            Nothing overflows today, but the header band this pane contains
            now holds a title, a month picker, a refresh and a privacy toggle,
            and the failure mode is not local: the pane would grow to fit the
            band, the document would grow with the pane, and every card on
            every page would inherit the overflow through its own `w-full`. */}
        <main className="flex min-h-0 min-w-0 flex-1 flex-col border-border md:border-l">
          <PageEnter>{children}</PageEnter>
        </main>
      </div>
      <BottomNav
        displayName={displayName}
        initial={initial}
        ledgerBadge={ledgerBadge}
      />
    </div>
  );
}

import type { ReactNode } from "react";
import { SideNav } from "@/components/layout/SideNav";
import { BottomNav } from "@/components/layout/BottomNav";
import { PageEnter } from "@/components/motion/PageEnter";
import { SHELL_MAIN_PADDING_BOTTOM } from "@/lib/layout-shell";
import { cn } from "@/lib/utils";

interface AppShellProps {
  children: ReactNode;
  displayName: string;
  initial: string;
}

export function AppShell({ children, displayName, initial }: AppShellProps) {
  return (
    <div className="flex min-h-screen md:bg-muted/30">
      <SideNav displayName={displayName} initial={initial} />
      <div
        className={cn(
          "flex min-h-screen min-w-0 flex-1 flex-col",
          SHELL_MAIN_PADDING_BOTTOM,
        )}
      >
        <main className="flex min-h-0 flex-1 flex-col border-border md:border-l md:bg-background">
          <PageEnter>{children}</PageEnter>
        </main>
      </div>
      <BottomNav displayName={displayName} initial={initial} />
    </div>
  );
}

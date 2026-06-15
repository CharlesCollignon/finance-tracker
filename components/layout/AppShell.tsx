import { SideNav } from "@/components/layout/SideNav";
import { BottomNav } from "@/components/layout/BottomNav";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen md:bg-muted/30">
      <SideNav />
      <div className="flex min-h-screen flex-1 flex-col pb-24 md:pb-0">
        <main className="flex-1 md:bg-background md:shadow-[-4px_0_0_0_var(--border)]">
          {children}
        </main>
      </div>
      <BottomNav />
    </div>
  );
}

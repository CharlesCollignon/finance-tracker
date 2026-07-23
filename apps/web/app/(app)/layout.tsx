import { AppShell } from "@/components/layout/AppShell";
import { ToastProvider } from "@/components/layout/ToastProvider";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ToastProvider>
      <AppShell>{children}</AppShell>
    </ToastProvider>
  );
}

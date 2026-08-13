import type { ReactNode } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { ToastProvider } from "@/components/layout/ToastProvider";
import { getAuthUser } from "@/lib/auth/get-user";
import { accountLabel } from "@/lib/account-label";

export default async function AppLayout({
  children,
}: {
  children: ReactNode;
}) {
  const user = await getAuthUser();
  const { name, initial } = accountLabel(user ?? {});

  return (
    <ToastProvider>
      <AppShell displayName={name} initial={initial}>
        {children}
      </AppShell>
    </ToastProvider>
  );
}

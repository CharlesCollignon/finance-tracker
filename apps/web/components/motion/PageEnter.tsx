"use client";

import { usePathname } from "next/navigation";

/**
 * Remount page content on route change so enter animations run once.
 * Intentionally no CSS fade here — Stagger owns the enter motion.
 */
export function PageEnter({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div
      key={pathname}
      className="flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden"
    >
      {children}
    </div>
  );
}

"use client";

import { usePathname } from "next/navigation";
import { tabbedSurfaceOf } from "@/components/layout/SurfaceTabs";

/**
 * Remount page content on route change so enter animations run once.
 * Intentionally no CSS fade here — Stagger owns the enter motion.
 *
 * Except between the views of one surface — the Ledger's list, calendar and
 * history, Placements' three — which share a layout holding their header
 * and tabs: remounting would throw that away and redraw it on every press.
 * Each view is its own page, so its own enter motion runs all the same.
 */
export function PageEnter({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div
      key={tabbedSurfaceOf(pathname) ?? pathname}
      className="flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden"
    >
      {children}
    </div>
  );
}

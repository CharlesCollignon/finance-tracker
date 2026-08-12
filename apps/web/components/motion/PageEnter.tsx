"use client";

import { usePathname } from "next/navigation";

/** Lightweight CSS enter on route change (no framer-motion). */
export function PageEnter({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div
      key={pathname}
      className="page-enter flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden"
    >
      {children}
    </div>
  );
}

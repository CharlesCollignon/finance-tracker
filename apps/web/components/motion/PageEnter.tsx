"use client";

import { usePathname } from "next/navigation";
import { FadeIn } from "@/components/motion/FadeIn";

/** Fade/slide page content on route change. */
export function PageEnter({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <FadeIn key={pathname} className="flex min-h-0 flex-1 flex-col">
      {children}
    </FadeIn>
  );
}

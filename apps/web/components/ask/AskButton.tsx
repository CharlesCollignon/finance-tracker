"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { domAnimation, LazyMotion, m, MotionConfig } from "motion/react";
import { Sparkle } from "@phosphor-icons/react";
import { useAccountLabel } from "@/components/layout/AccountLabel";
import { ICON } from "@/lib/icon-scale";
import { useT } from "@/lib/locale-context";
import { cn } from "@/lib/utils";

/**
 * « Questions », beside the refresh: a sparkle for the AI, on every screen
 * of the app, the same size and tone as the controls around it. The sparkle
 * turns a little under the pointer and fills on the screen it opens.
 * Nothing outside the app shell, like the account menu.
 */
export function AskButton({
  tone = "band",
  className,
}: {
  tone?: "band" | "bar";
  className?: string;
}) {
  const t = useT();
  const pathname = usePathname();
  const inShell = useAccountLabel() !== null;
  if (!inShell) {
    return null;
  }
  const here = pathname === "/ask" || pathname.startsWith("/ask/");
  const label = t("ask.title");

  return (
    <LazyMotion features={domAnimation} strict>
      <MotionConfig reducedMotion="user">
        <Link
          href="/ask"
          aria-label={label}
          aria-current={here ? "page" : undefined}
          title={label}
          className={cn(
            "group relative inline-flex size-11 shrink-0 items-center justify-center transition-colors",
            here
              ? "text-foreground"
              : "text-muted-foreground hover:bg-muted hover:text-foreground",
            tone === "band"
              ? "rounded-control border border-border bg-card"
              : "rounded-full",
            className,
          )}
        >
          <m.span
            className="flex"
            whileHover={{ rotate: 18, scale: 1.12 }}
            whileTap={{ scale: 0.9 }}
            transition={{ type: "spring", stiffness: 420, damping: 18 }}
          >
            <Sparkle size={ICON.lg} weight={here ? "fill" : "regular"} />
          </m.span>
        </Link>
      </MotionConfig>
    </LazyMotion>
  );
}

"use client";

import Link from "next/link";
import { domAnimation, LazyMotion, m, MotionConfig } from "motion/react";
import { ArrowRight, Receipt } from "@phosphor-icons/react";
import { GLASS_CARD } from "@/lib/glass";
import { ICON } from "@/lib/icon-scale";
import { useT } from "@/lib/locale-context";
import { cn } from "@/lib/utils";

/**
 * Le point in April to June: the return's amounts are ready. One card that
 * arrives with a small lift and leads to « Déclaration de revenus ».
 */
export function TaxSeasonCard({ year }: { year: number }) {
  const t = useT();
  return (
    <LazyMotion features={domAnimation} strict>
      <MotionConfig reducedMotion="user">
        <m.div
          initial={{ opacity: 0, y: 10, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 26 }}
        >
          <Link
            href="/tax"
            className={cn(
              GLASS_CARD,
              "group flex items-center gap-4 rounded-card p-card transition-colors duration-hover hover:border-foreground/20",
            )}
          >
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted">
              <Receipt size={ICON.lg} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium">
                {t("tax.seasonTitle")}
              </span>
              <span className="block text-sm text-muted-foreground">
                {t("tax.seasonBody", { year })}
              </span>
            </span>
            <span className="flex items-center gap-1 text-sm font-medium">
              {t("tax.seasonCta")}
              <ArrowRight
                size={ICON.md}
                className="transition-transform duration-hover group-hover:translate-x-1"
              />
            </span>
          </Link>
        </m.div>
      </MotionConfig>
    </LazyMotion>
  );
}

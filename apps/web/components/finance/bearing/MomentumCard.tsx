"use client";

import Link from "next/link";
import { Fire, TrendUp } from "@phosphor-icons/react";
import type { BearingMonth } from "@/lib/bearing/month";
import { PrivateAmount } from "@/components/layout/PrivateAmount";
import { ICON } from "@/lib/icon-scale";
import { useFormatCurrency } from "@/lib/use-currency";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/locale-context";
import { Card } from "@/components/finance/bearing/card-parts";

/* ------------------------------------------------------------ the run */

/**
 * What the month is adding up to beyond itself: the run of months closed
 * under the allowance, and what is invested.
 * The one card on the screen that keeps score, so it is the one that is
 * allowed to feel like it.
 */
export function MomentumCard({ data }: { data: BearingMonth }) {
  const t = useT();
  const format = useFormatCurrency();

  return (
    <Card
      icon={<Fire size={ICON.sm} weight="bold" />}
      title={t("removal.momentumTitle")}
      href="/plan"
    >
      {data.run ? (
        <div className="flex items-center gap-3 rounded-control bg-accent px-3 py-2.5">
          <span
            className={cn(
              "flex size-10 shrink-0 items-center justify-center rounded-full",
              data.run.streak > 0
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground",
            )}
          >
            <Fire size={ICON.lg} weight="fill" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold">
              {data.run.streak > 0
                ? t("bearingMonth.run", { count: data.run.streak })
                : t("bearingMonth.noRunYet")}
            </p>
            <p className="text-xs text-muted-foreground">
              {t("bearingMonth.runBody")}
              {data.run.best > data.run.streak
                ? ` · ${t("bearingMonth.bestRun", { count: data.run.best })}`
                : ""}
            </p>
          </div>
        </div>
      ) : null}

      {data.invested !== null ? (
        <Link
          href="/investments"
          className="mt-auto flex items-center justify-between gap-3 rounded-control border border-border px-3 py-2.5 transition-colors duration-hover hover:bg-muted"
        >
          <span className="flex items-center gap-2 text-sm text-muted-foreground">
            <TrendUp size={ICON.md} />
            {t("bearingMonth.invested")}
          </span>
          <PrivateAmount className="text-sm font-semibold tabular-nums">
            {format(data.invested)}
          </PrivateAmount>
        </Link>
      ) : null}
    </Card>
  );
}

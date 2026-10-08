"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Sparkle } from "@phosphor-icons/react";
import { Button, buttonVariants } from "@/components/ui/Button";
import { dismissYearReview } from "@/lib/actions/year-review";
import { GLASS_CARD } from "@/lib/glass";
import { ICON } from "@/lib/icon-scale";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/locale-context";

/**
 * January's card on Le point: « Votre année » is ready. It opens the review,
 * and « Vu » puts it away on every device.
 */
export function YearReadyCard({ year }: { year: number }) {
  const t = useT();
  const [gone, setGone] = useState(false);
  const [, startTransition] = useTransition();
  if (gone) {
    return null;
  }
  return (
    <section
      className={cn(
        GLASS_CARD,
        "flex flex-col gap-3 rounded-card p-card sm:flex-row sm:items-center sm:justify-between",
      )}
    >
      <div className="flex items-start gap-3">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <Sparkle size={ICON.md} weight="fill" aria-hidden />
        </span>
        <div>
          <h2 className="text-base font-semibold">
            {t("yearReview.ready", { year })}
          </h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {t("yearReview.readyBody")}
          </p>
        </div>
      </div>
      <div className="flex shrink-0 gap-2">
        <Link
          href={`/year?y=${year}`}
          className={buttonVariants({ size: "sm" })}
        >
          {t("yearReview.open")}
        </Link>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {
            setGone(true);
            startTransition(async () => {
              await dismissYearReview(year);
            });
          }}
        >
          {t("yearReview.seen")}
        </Button>
      </div>
    </section>
  );
}

"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  CaretDown,
  CaretUp,
  ListChecks,
} from "@phosphor-icons/react";
import type { AttentionItem } from "@finance/core/attention";
import { formatShortDate } from "@finance/core/constants";
import { GLASS_CARD } from "@/lib/glass";
import { ICON } from "@/lib/icon-scale";
import { MICRO } from "@/lib/type-scale";
import { useLocale, useT } from "@/lib/locale-context";
import { cn } from "@/lib/utils";

/** How many items the strip shows before folding the rest behind « +N ». */
const SHOWN = 3;

/**
 * « À faire »: everything waiting for the reader, in one strip under the
 * month picker, with its count.
 *
 * It replaces a row that named the top item and a « +N » for the rest, and
 * the two banners that sat above it — a bank about to stop, accounts the
 * bank shows that nobody has filed — each counting on its own. The decision
 * cards keep their place below; the strip is the one place that counts, and
 * each line leads to where its thing is done: the review, the close, a card
 * further down this screen, the Bank page, the import.
 *
 * Renders nothing when nothing is waiting — there is no "all clear" row,
 * for the same reason `buildAttention` builds no "all clear" item. The
 * phone draws the same strip.
 */
export function TodoStrip({
  items,
  className,
}: {
  items: AttentionItem[];
  className?: string;
}) {
  const t = useT();
  const locale = useLocale();
  const [open, setOpen] = useState(false);

  if (items.length === 0) {
    return null;
  }
  const shown = open ? items : items.slice(0, SHOWN);
  const hidden = items.length - shown.length;

  return (
    <section
      aria-label={t("month.todo")}
      className={cn(GLASS_CARD, "rounded-card px-card py-3", className)}
    >
      <header className="mb-1 flex items-center gap-2">
        <ListChecks
          size={ICON.sm}
          weight="bold"
          aria-hidden
          className="text-muted-foreground"
        />
        <h2 className="text-sm font-medium text-muted-foreground">
          {t("month.todo")}
        </h2>
        <span
          className={cn(
            MICRO,
            "rounded-full bg-muted px-2 py-0.5 tabular-nums text-foreground",
          )}
        >
          {items.length}
        </span>
      </header>
      <ul className="flex flex-col">
        {shown.map((item) => {
          const vars = {
            ...item.params,
            ...(item.date
              ? { date: formatShortDate(item.date, locale) }
              : {}),
          };
          return (
            <li key={item.id}>
              <Link
                href={item.href}
                className="group -mx-1 flex items-center gap-3 rounded-control px-1 py-1.5 transition-colors duration-hover hover:bg-muted/40"
              >
                <span
                  aria-hidden
                  className={cn(
                    "size-2 shrink-0 rounded-full",
                    item.tone === "wrong" ? "bg-destructive" : "bg-foreground",
                  )}
                />
                <span className="min-w-0 flex-1 text-sm">
                  {t(item.messageKey, vars)}
                </span>
                <span className="flex shrink-0 items-center gap-1 text-sm font-medium text-foreground">
                  {t(item.actionKey, vars)}
                  <ArrowRight
                    size={ICON.sm}
                    className="transition-transform group-hover:translate-x-0.5"
                  />
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
      {hidden > 0 || open ? (
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className={cn(
            MICRO,
            "mt-1 flex items-center gap-1 text-muted-foreground transition-colors duration-hover hover:text-foreground",
          )}
        >
          {open
            ? t("month.todoLess")
            : t("bearing.spine.moreWaiting", { count: hidden })}
          {open ? <CaretUp size={ICON.sm} /> : <CaretDown size={ICON.sm} />}
        </button>
      ) : null}
    </section>
  );
}

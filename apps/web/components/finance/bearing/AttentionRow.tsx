"use client";

import Link from "next/link";
import { ArrowRight } from "@phosphor-icons/react";
import type { AttentionItem } from "@finance/core/attention";
import { useT } from "@/lib/locale-context";
import { ICON } from "@/lib/icon-scale";
import { MICRO } from "@/lib/type-scale";
import { cn } from "@/lib/utils";

/**
 * The one thing most worth doing next, and how many others are waiting.
 *
 * Lifted out of `Spine` because the reader who needs it most was the one
 * reader the spine never reached. `bearing/page.tsx` returns its `thin`
 * empty state — no net position, nothing invested, nothing recorded —
 * before the spine mounts at all, and that state is exactly what somebody
 * who has just finished `/welcome` sees: recurring templates saved, not one
 * row written. `buildAttention` had already produced their "apply these"
 * item and the page was throwing it away.
 *
 * Only the row moved, not the spine. A ring and a headline over an account
 * with nothing in it would be worse than nothing — the headline falls back
 * to the month's plain arithmetic, which on a brand-new account is a hero-
 * sized zero, and the ring would be dark, both of them stating a
 * measurement of a position that does not exist yet. The row states no
 * figure about the account at all. It names a thing to do and links to
 * where it is done, which is the whole of what that reader needs.
 *
 * Renders nothing when nothing is waiting — there is no "all clear" row,
 * for the same reason `buildAttention` builds no "all clear" item.
 */
export function AttentionRow({
  attention,
  className,
}: {
  attention: AttentionItem[];
  className?: string;
}) {
  const t = useT();
  const top = attention[0];
  const rest = attention.length - 1;

  if (!top) {
    return null;
  }

  return (
    <Link
      href={top.href}
      className={cn(
        "group -mx-1 flex items-center gap-3 rounded-control px-1 py-1.5",
        "transition-colors hover:bg-muted/40",
        className,
      )}
    >
      <span
        aria-hidden
        className={cn(
          "size-2 shrink-0 rounded-full",
          top.tone === "wrong" ? "bg-destructive" : "bg-primary",
        )}
      />
      <span className="min-w-0 flex-1 truncate text-sm">
        {t(top.messageKey, top.params)}
      </span>
      {rest > 0 ? (
        <span className={cn(MICRO, "shrink-0 text-muted-foreground")}>
          {t("bearing.spine.moreWaiting", { count: rest })}
        </span>
      ) : null}
      <span className="flex shrink-0 items-center gap-1 text-sm font-medium text-primary-ink">
        {t(top.actionKey)}
        <ArrowRight
          size={ICON.sm}
          className="transition-transform group-hover:translate-x-0.5"
        />
      </span>
    </Link>
  );
}

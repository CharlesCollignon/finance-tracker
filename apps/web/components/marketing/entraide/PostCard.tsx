"use client";

import Link from "next/link";
import { m } from "motion/react";
import { ChatCircle, CheckCircle, ThumbsUp } from "@phosphor-icons/react";
import { countLabel } from "@/components/marketing/nouveautes-copy";
import type { EntraideCopy } from "@finance/core/entraide-copy";
import { AuthorLine } from "@/components/marketing/entraide/AuthorLine";
import { marketingFocus } from "@/components/marketing/marketing-focus";
import type { EntraideCard } from "@/lib/entraide-cards";
import { FADE, FADE_IN } from "@/components/motion/fade";
import { cn } from "@/lib/utils";

/**
 * A question or a share in the list: what kind, whether it is solved, its
 * title and first words, who and when, how many answers and « Utile ». The
 * whole card is the link. A just-published one carries the composer's
 * `layoutId`, so the editor becomes it.
 */
export function PostCard({
  card,
  copy,
  layoutId,
}: {
  card: EntraideCard;
  copy: EntraideCopy;
  layoutId?: string;
}) {
  return (
    <m.li
      layout
      layoutId={layoutId}
      initial={layoutId ? false : FADE.initial}
      animate={FADE.animate}
      exit={FADE.exit}
      transition={FADE_IN}
      className="min-w-0"
    >
      <Link
        href={card.href}
        className={cn(
          "glass-flat glass-flat-hover group flex flex-col gap-2.5 rounded-[1.5rem] p-5 md:p-6",
          marketingFocus,
        )}
      >
        <p className="flex flex-wrap items-center gap-2 text-[11px] font-medium uppercase tracking-[0.16em] text-marketing-faint">
          <span>{copy.kinds[card.kind]}</span>
          {card.solved ? (
            <span className="inline-flex items-center gap-1 text-primary">
              <CheckCircle size={13} weight="fill" aria-hidden />
              {copy.list.solved}
            </span>
          ) : null}
        </p>
        <h2
          className={cn(
            "font-head text-lg leading-snug tracking-[-0.01em]",
            card.gone ? "italic text-marketing-faint" : "text-marketing-ink",
          )}
        >
          {card.gone ? copy.list.gone : card.title}
        </h2>
        {card.excerpt ? (
          <p className="line-clamp-2 text-[0.95rem] leading-relaxed text-marketing-muted">
            {card.excerpt}
          </p>
        ) : null}
        <div className="mt-1 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <AuthorLine
            handle={card.handle}
            isPluclair={card.isPluclair}
            when={card.when}
            pluclairLabel={copy.list.pluclair}
          />
          <p className="flex items-center gap-3 text-sm text-marketing-faint">
            <span className="inline-flex items-center gap-1.5">
              <ChatCircle size={15} aria-hidden />
              {card.replyCount > 0
                ? countLabel(copy.list.replies, card.replyCount)
                : copy.list.noReply}
            </span>
            {card.usefulCount > 0 ? (
              <span className="inline-flex items-center gap-1 tabular-nums">
                <ThumbsUp size={15} aria-hidden />
                {card.usefulCount}
              </span>
            ) : null}
          </p>
        </div>
      </Link>
    </m.li>
  );
}

import {
  excerptOf,
  threadHref,
  type EntraidePostSummary,
  type PostKind,
} from "@finance/core/entraide";
import type { Locale } from "@finance/core/i18n/locale";
import { entraideWhen } from "@finance/core/entraide-copy";

/**
 * A question or a share as the list draws it, everything already said in
 * words — dates included, written on the server so the page reads the same
 * once hydrated as it did when it arrived.
 */
export interface EntraideCard {
  id: number;
  kind: PostKind;
  title: string;
  excerpt: string;
  href: string;
  handle: string | null;
  isPluclair: boolean;
  isMine: boolean;
  gone: boolean;
  when: string;
  replyCount: number;
  solved: boolean;
  usefulCount: number;
}

export function toCard(
  post: EntraidePostSummary,
  locale: Locale,
  now: Date,
): EntraideCard {
  return {
    id: post.id,
    kind: post.kind,
    title: post.title,
    excerpt: post.gone ? "" : excerptOf(post.excerpt),
    href: threadHref(post.id, post.title),
    handle: post.author.handle,
    isPluclair: post.author.isPluclair,
    isMine: post.author.isMine,
    gone: post.gone,
    when: entraideWhen(post.lastActivityAt, now, locale),
    replyCount: post.replyCount,
    solved: post.solved,
    usefulCount: post.usefulCount,
  };
}

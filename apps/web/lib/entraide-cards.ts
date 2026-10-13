import { formatFullDate } from "@finance/core/constants";
import {
  excerptOf,
  threadHref,
  type EntraidePostSummary,
  type PostKind,
} from "@finance/core/entraide";
import type { Locale } from "@finance/core/i18n/locale";
import { entraideCopyFor } from "@/components/marketing/entraide-copy";
import { dayAndMonth } from "@/components/marketing/nouveautes/river-entry";

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

function parisDay(at: Date): string {
  // Swedish writes a date as YYYY-MM-DD, which is all that is wanted here.
  return at.toLocaleDateString("sv-SE", { timeZone: "Europe/Paris" });
}

/** « à l'instant », « il y a 12 min », « hier », « 3 octobre ». */
export function entraideWhen(iso: string, now: Date, locale: Locale): string {
  const words = entraideCopyFor(locale).when;
  const at = new Date(iso);
  const minutes = Math.floor((now.getTime() - at.getTime()) / 60_000);
  if (minutes < 1) {
    return words.now;
  }
  if (minutes < 60) {
    return words.minutes.replace("{count}", String(minutes));
  }
  if (minutes < 24 * 60) {
    return words.hours.replace("{count}", String(Math.floor(minutes / 60)));
  }
  if (minutes < 48 * 60) {
    return words.yesterday;
  }
  const day = parisDay(at);
  return day.slice(0, 4) === parisDay(now).slice(0, 4)
    ? dayAndMonth(day, locale)
    : formatFullDate(day, locale);
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

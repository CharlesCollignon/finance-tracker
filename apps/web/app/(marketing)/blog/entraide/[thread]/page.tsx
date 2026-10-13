import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { excerptOf, threadHref, threadIdOf } from "@finance/core/entraide";
import { entraideCopyFor } from "@finance/core/entraide-copy";
import {
  indexable,
  readThreadFor,
  ThreadPage,
} from "@/components/marketing/entraide/ThreadPage";
import { entraideRulesVisible } from "@/components/marketing/legal-status";
import { getLocale } from "@/lib/locale";
import { shareMetadata } from "@/lib/og/share-metadata";

interface ThreadRouteProps {
  params: Promise<{ thread: string }>;
}

export async function generateMetadata({
  params,
}: ThreadRouteProps): Promise<Metadata> {
  const id = threadIdOf((await params).thread);
  const thread = id && entraideRulesVisible() ? await readThreadFor(id) : null;
  const locale = await getLocale();
  if (!thread) {
    return { title: `${entraideCopyFor(locale).meta.title} — Pluclair` };
  }
  const { post } = thread;
  const title = post.gone ? entraideCopyFor(locale).list.gone : post.title;
  return {
    ...shareMetadata({
      title: `${title} — Entraide — Pluclair`,
      description: excerptOf(post.body || post.title, 160),
      path: threadHref(post.id, post.title),
      locale,
    }),
    ...(indexable(post) ? {} : { robots: { index: false } }),
  };
}

/** A thread. Like the list, it opens with Entraide's rules. */
export default async function ThreadRoutePage({ params }: ThreadRouteProps) {
  if (!entraideRulesVisible()) {
    notFound();
  }
  const param = (await params).thread;
  const id = threadIdOf(param);
  if (!id) {
    notFound();
  }
  return <ThreadPage id={id} param={param} />;
}

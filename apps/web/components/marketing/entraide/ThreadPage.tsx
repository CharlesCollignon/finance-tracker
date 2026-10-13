/* Hallmark · genre: atmospheric · macrostructure: Long Document (a question, its answers, a reply) · theme: design.md (Pluclair) · enrichment: none — the words are members' · nav: kept · footer: kept */

import { cache } from "react";
import { notFound, permanentRedirect } from "next/navigation";
import { threadHref, type EntraidePost } from "@finance/core/entraide";
import { postTarget, replyTarget } from "@finance/core/reactions";
import * as entraide from "@finance/data/entraide";
import { readReactions } from "@finance/data/reactions";
import { getAuthUser } from "@/lib/auth/get-user";
import { guideHref, isGuideSlug } from "@/lib/guide-list";
import { loadGuide } from "@/lib/guides";
import { getLocale } from "@/lib/locale";
import { getSiteUrl } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { entraideCopyFor, entraideWhen } from "@finance/core/entraide-copy";
import { ThreadView } from "@/components/marketing/entraide/ThreadView";

/** Read once per request, for the page and its metadata alike. */
export const readThreadFor = cache(async (id: number) => {
  const db = await createClient();
  return entraide.readThread(db, id).catch(() => null);
});

/** Whether search engines should keep the thread: not once it is gone. */
export function indexable(post: EntraidePost): boolean {
  return post.status === "visible" && !post.gone;
}

/**
 * A thread's page: the question and its answers (`ThreadView`), at the
 * address its title gives — an old one redirects there — with what a
 * search engine needs to read it as a question and its answers.
 */
export async function ThreadPage({ id, param }: { id: number; param: string }) {
  const thread = await readThreadFor(id);
  if (!thread) {
    notFound();
  }
  const { post, replies } = thread;
  const href = threadHref(post.id, post.title);
  if (!post.gone && `/blog/entraide/${param}` !== href) {
    permanentRedirect(href);
  }

  const locale = await getLocale();
  const copy = entraideCopyFor(locale);
  const user = await getAuthUser();
  const guideSlug =
    post.guideSlug && isGuideSlug(post.guideSlug) ? post.guideSlug : null;
  const db = await createClient();
  const targets = [
    postTarget(post.id),
    ...replies.map((reply) => replyTarget(reply.id)),
  ];
  const myHidden = [
    ...(post.author.isMine && post.status === "hidden"
      ? [postTarget(post.id)]
      : []),
    ...replies
      .filter((reply) => reply.author.isMine && reply.status === "hidden")
      .map((reply) => replyTarget(reply.id)),
  ];
  const [tallies, handle, guide, reported, decisions] = await Promise.all([
    readReactions(db, targets, user?.id ?? null).catch(() => new Map()),
    user
      ? entraide.readMyHandle(db, user.id).catch(() => null)
      : Promise.resolve(null),
    guideSlug
      ? loadGuide(guideSlug).then(({ meta }) => ({
          title: meta.title,
          href: guideHref(guideSlug),
        }))
      : Promise.resolve(null),
    user
      ? entraide
          .readMyReports(db, user.id, targets)
          .catch(() => new Set<string>())
      : Promise.resolve(new Set<string>()),
    user && myHidden.length > 0
      ? entraide.readMyDecisions(db, user.id, myHidden).catch(() => new Map())
      : Promise.resolve(new Map()),
  ]);
  const now = new Date();
  const shown = replies.filter(
    (reply) => !reply.gone && reply.status === "visible",
  );
  const accepted = shown.find((reply) => reply.id === post.solvedReplyId);

  // For search engines: a question and its answers (QAPage).
  const jsonLd =
    post.kind === "question" && indexable(post)
      ? {
          "@context": "https://schema.org",
          "@type": "QAPage",
          mainEntity: {
            "@type": "Question",
            name: post.title,
            text: post.body || post.title,
            answerCount: shown.length,
            datePublished: post.createdAt,
            author: { "@type": "Person", name: post.author.handle },
            url: new URL(href, getSiteUrl()).toString(),
            ...(accepted
              ? {
                  acceptedAnswer: {
                    "@type": "Answer",
                    text: accepted.body,
                    datePublished: accepted.createdAt,
                    author: { "@type": "Person", name: accepted.author.handle },
                  },
                }
              : {}),
            suggestedAnswer: shown
              .filter((reply) => reply.id !== post.solvedReplyId)
              .slice(0, 10)
              .map((reply) => ({
                "@type": "Answer",
                text: reply.body,
                datePublished: reply.createdAt,
                author: { "@type": "Person", name: reply.author.handle },
              })),
          },
        }
      : null;

  return (
    <div className="relative isolate overflow-x-clip px-6 pb-24 pt-32 md:pb-32 md:pt-40">
      {jsonLd ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c"),
          }}
        />
      ) : null}
      <ThreadView
        thread={{
          id: post.id,
          kind: post.kind,
          title: post.title,
          body: post.body,
          handle: post.author.handle,
          isPluclair: post.author.isPluclair,
          isMine: post.author.isMine,
          hidden: post.status === "hidden",
          gone: post.gone,
          when: entraideWhen(post.createdAt, now, locale),
          edited: post.editedAt !== null,
          solvedReplyId: post.solvedReplyId,
          guide,
          replies: replies.map((reply) => ({
            id: reply.id,
            body: reply.body,
            handle: reply.author.handle,
            isPluclair: reply.author.isPluclair,
            isMine: reply.author.isMine,
            hidden: reply.status === "hidden",
            gone: reply.gone,
            when: entraideWhen(reply.createdAt, now, locale),
            edited: reply.editedAt !== null,
          })),
        }}
        tallies={Object.fromEntries(tallies)}
        reported={[...reported]}
        decisions={Object.fromEntries(decisions)}
        copy={copy}
        signedIn={Boolean(user)}
        handle={handle}
        loginHref={`/login?next=${encodeURIComponent(href)}`}
      />
    </div>
  );
}

import type { Metadata } from "next";
import { BlogIndex } from "@/components/marketing/blog/BlogIndex";
import { blogCopyFor } from "@/components/marketing/blog-copy";
import { BLOG_HREF, BLOG_RSS_HREF } from "@/lib/guide-list";
import { getLocale } from "@/lib/locale";
import { shareMetadata } from "@/lib/og/share-metadata";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const { meta } = blogCopyFor(locale);
  return shareMetadata({
    title: `${meta.title} — Pluclair`,
    description: meta.description,
    path: BLOG_HREF,
    feed: BLOG_RSS_HREF,
    locale,
  });
}

/** The guides, and the door to Entraide (`BlogIndex.tsx`). */
export default function BlogRoutePage() {
  return <BlogIndex />;
}

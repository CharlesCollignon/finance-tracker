import { entraideCopyFor } from "@finance/core/entraide-copy";
import { ENTRAIDE_HREF } from "@finance/core/entraide";
import { ABOUT_HREF, aboutCopyFor } from "@/components/marketing/about-copy";
import { blogCopyFor } from "@/components/marketing/blog-copy";
import {
  DOWNLOAD_HREF,
  downloadCopyFor,
} from "@/components/marketing/download-copy";
import {
  featureHref,
  landingCopyFor,
} from "@/components/marketing/landing-copy";
import { entraideRulesVisible } from "@/components/marketing/legal-status";
import {
  NOUVEAUTES_HREF,
  nouveautesCopyFor,
} from "@/components/marketing/nouveautes-copy";
import { BLOG_HREF, guideHref } from "@/lib/guide-list";
import { demoAvailable } from "@/lib/demo-env";
import { allGuides } from "@/lib/guides";
import { storeLinks } from "@/lib/store-links";
import { getSiteUrl } from "@/lib/supabase/env";

/**
 * `/llms.txt` (llmstxt.org): the site in a few lines of Markdown, for the
 * assistants people now ask instead of a search engine. In French, like the
 * site's default, and made only of the sentences the pages themselves say.
 */
export async function GET() {
  const base = getSiteUrl();
  const link = (title: string, path: string, line: string) =>
    `- [${title}](${new URL(path, base).toString()}): ${line}`;

  const landing = landingCopyFor("fr");
  const about = aboutCopyFor("fr");
  const news = nouveautesCopyFor("fr");
  const blog = blogCopyFor("fr");
  const download = downloadCopyFor("fr");
  const guides = await allGuides();
  const android = Boolean(storeLinks().androidApk);

  const sections = [
    `# Pluclair`,
    `> ${landing.hero.tagline}`,
    [
      `Application gratuite pour suivre son budget, son épargne et ses placements, pensée pour la France : sur le web${android ? " et sur Android" : ""}.`,
      ...(demoAvailable()
        ? [`Pour l'essayer sans compte : ${new URL("/demo", base).toString()}`]
        : []),
    ].join("\n"),
    [
      "## Fonctionnalités",
      ...landing.pages.map((page) =>
        link(page.title, featureHref(page.id), page.body),
      ),
    ].join("\n"),
    [
      `## ${blog.meta.title}`,
      ...guides.map(({ slug, meta }) =>
        link(meta.title, guideHref(slug), meta.description),
      ),
    ].join("\n"),
    [
      "## Questions fréquentes",
      ...landing.faq.items.map((item) => `- ${item.question} ${item.answer}`),
    ].join("\n"),
    [
      "## Le site",
      link(about.meta.title, ABOUT_HREF, about.meta.description),
      ...(android
        ? [link(download.meta.title, DOWNLOAD_HREF, download.meta.description)]
        : []),
      link(news.meta.title, NOUVEAUTES_HREF, news.meta.description),
      link(blog.meta.title, BLOG_HREF, blog.meta.description),
      ...(entraideRulesVisible()
        ? [
            link(
              entraideCopyFor("fr").meta.title,
              ENTRAIDE_HREF,
              entraideCopyFor("fr").meta.description,
            ),
          ]
        : []),
    ].join("\n"),
  ];

  return new Response(`${sections.join("\n\n")}\n`, {
    headers: { "Content-Type": "text/markdown; charset=utf-8" },
  });
}

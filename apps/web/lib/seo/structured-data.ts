import type { Locale } from "@finance/core/i18n/locale";

/**
 * What a public page says about itself to search engines and AI answer
 * engines, as schema.org JSON-LD (`components/JsonLd.tsx` renders it).
 *
 * Only what is true and already on the page: no rating, no review count, no
 * price other than the free one. A rich result built on a claim the page
 * does not make is one Google withdraws, and one a reader would not trust.
 */

type Node = Record<string, unknown>;

const NAME = "Pluclair";

function absolute(path: string, base: string): string {
  return new URL(path, base).toString();
}

function language(locale: Locale): string {
  return locale === "fr" ? "fr-FR" : "en-GB";
}

/** Who publishes the site: one node every other one points to by `@id`. */
export function organization(base: string): Node {
  return {
    "@type": "Organization",
    "@id": absolute("/#organization", base),
    name: NAME,
    url: absolute("/", base),
    logo: absolute("/icon.png", base),
  };
}

/** The site itself, published by the organisation. */
export function website(base: string, locale: Locale): Node {
  return {
    "@type": "WebSite",
    "@id": absolute("/#website", base),
    name: NAME,
    url: absolute("/", base),
    inLanguage: language(locale),
    publisher: { "@id": absolute("/#organization", base) },
  };
}

/**
 * The app: free, in a browser and on Android. `downloadUrl` only once the
 * APK is actually offered (`storeLinks().androidApk`).
 */
export function softwareApplication({
  base,
  description,
  downloadPath,
}: {
  base: string;
  description: string;
  downloadPath: string | null;
}): Node {
  return {
    "@type": "SoftwareApplication",
    "@id": absolute("/#app", base),
    name: NAME,
    description,
    url: absolute("/", base),
    applicationCategory: "FinanceApplication",
    operatingSystem: downloadPath ? "Web, Android" : "Web",
    ...(downloadPath ? { downloadUrl: absolute(downloadPath, base) } : {}),
    offers: { "@type": "Offer", price: "0", priceCurrency: "EUR" },
    publisher: { "@id": absolute("/#organization", base) },
  };
}

/** Questions answered on the page, word for word as the page shows them. */
export function faqPage(
  items: readonly { question: string; answer: string }[],
  locale: Locale,
): Node {
  return {
    "@type": "FAQPage",
    inLanguage: language(locale),
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: { "@type": "Answer", text: item.answer },
    })),
  };
}

/** One guide of « Le blog ». The guides exist only in French. */
export function article({
  base,
  path,
  title,
  description,
  published,
  updated,
}: {
  base: string;
  path: string;
  title: string;
  description: string;
  published: string;
  updated: string;
}): Node {
  return {
    "@type": "Article",
    "@id": absolute(`${path}#article`, base),
    headline: title,
    description,
    inLanguage: language("fr"),
    datePublished: published,
    dateModified: updated,
    mainEntityOfPage: absolute(path, base),
    // Whole rather than by `@id`: the organisation's own node is on the home
    // page, and a guide is read without it.
    author: organization(base),
    publisher: organization(base),
  };
}

/** Several nodes in one script, under one context. */
export function graph(nodes: Node[]): Node {
  return { "@context": "https://schema.org", "@graph": nodes };
}

/**
 * The script's text. `JSON.stringify` leaves `<` alone, so a `</script>` in
 * any string — an Entraide title one day — would close the tag; escaped, it
 * cannot (`node_modules/next/dist/docs/01-app/02-guides/json-ld.md`).
 */
export function serializeJsonLd(data: Node): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

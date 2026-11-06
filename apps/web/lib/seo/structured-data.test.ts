import { describe, expect, it } from "vitest";
import { landingCopyFor } from "@/components/marketing/landing-copy";
import {
  article,
  faqPage,
  graph,
  serializeJsonLd,
  softwareApplication,
} from "./structured-data";

const base = "https://pluclair.com";

describe("structured data", () => {
  it("states the app as free, and Android only when the APK is offered", () => {
    const web = softwareApplication({
      base,
      description: "x",
      downloadPath: null,
    });
    expect(web.operatingSystem).toBe("Web");
    expect(web).not.toHaveProperty("downloadUrl");
    expect(web.offers).toEqual({
      "@type": "Offer",
      price: "0",
      priceCurrency: "EUR",
    });

    const android = softwareApplication({
      base,
      description: "x",
      downloadPath: "/android",
    });
    expect(android.downloadUrl).toBe("https://pluclair.com/android");
  });

  it("answers the landing's questions word for word, in its language", () => {
    const { faq } = landingCopyFor("fr");
    const node = faqPage(faq.items, "fr") as {
      inLanguage: string;
      mainEntity: { name: string; acceptedAnswer: { text: string } }[];
    };
    expect(node.inLanguage).toBe("fr-FR");
    expect(node.mainEntity).toHaveLength(faq.items.length);
    expect(node.mainEntity[0].name).toBe(faq.items[0].question);
    expect(node.mainEntity[0].acceptedAnswer.text).toBe(faq.items[0].answer);
  });

  it("dates a guide and names who wrote it", () => {
    const node = article({
      base,
      path: "/blog/bilan-du-mois",
      title: "T",
      description: "D",
      published: "2026-10-12",
      updated: "2026-10-20",
    }) as Record<string, unknown> & { author: { name: string } };
    expect(node.mainEntityOfPage).toBe(
      "https://pluclair.com/blog/bilan-du-mois",
    );
    expect(node.dateModified).toBe("2026-10-20");
    expect(node.author.name).toBe("Pluclair");
  });

  it("cannot close its own script tag", () => {
    const text = serializeJsonLd(
      graph([faqPage([{ question: "</script><b>", answer: "a" }], "fr")]),
    );
    expect(text).not.toContain("<");
    expect(JSON.parse(text)["@graph"][0].mainEntity[0].name).toBe(
      "</script><b>",
    );
  });
});

import { describe, expect, it } from "vitest";
import {
  featureHref,
  featureIdOfSlug,
  landingCopy,
} from "@/components/marketing/landing-copy";
import { FEATURE_SLUGS, legacyFeatureRedirects } from "./feature-slugs";

describe("feature page addresses", () => {
  const ids = landingCopy.pages.map((page) => page.id);

  it("gives every page one address, and names no other page", () => {
    expect(Object.keys(FEATURE_SLUGS).sort()).toEqual([...ids].sort());
    const slugs = Object.values(FEATURE_SLUGS);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const slug of slugs) {
      expect(slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    }
  });

  it("reads a page back from its address", () => {
    for (const id of ids) {
      expect(featureHref(id)).toBe(`/fonctionnalites/${FEATURE_SLUGS[id]}`);
      expect(featureIdOfSlug(FEATURE_SLUGS[id])).toBe(id);
    }
    expect(featureIdOfSlug("bearing")).toBeNull();
  });

  it("sends every old address to a page that exists", () => {
    const live = new Set(ids.map(featureHref));
    const redirects = legacyFeatureRedirects();
    for (const id of ids) {
      expect(redirects).toContainEqual({
        source: `/features/${id}`,
        destination: featureHref(id),
      });
    }
    for (const { destination } of redirects) {
      expect(live.has(destination)).toBe(true);
    }
    expect(redirects).toContainEqual({
      source: "/features/home",
      destination: "/fonctionnalites/le-point",
    });
  });
});

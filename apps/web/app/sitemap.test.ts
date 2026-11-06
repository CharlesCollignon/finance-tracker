import { beforeEach, describe, expect, it, vi } from "vitest";
import type { EntraidePostSummary } from "@finance/core/entraide";

const readEntraideList = vi.fn();

vi.mock("server-only", () => ({}));
vi.mock("@finance/data/entraide", () => ({
  readEntraideList: (...args: unknown[]) => readEntraideList(...args),
}));
vi.mock("@/components/marketing/legal-status", () => ({
  entraideRulesVisible: () => true,
  legalPagesVisible: () => true,
}));

function post(id: number, gone = false): EntraidePostSummary {
  return {
    id,
    kind: "question",
    title: `Question ${id}`,
    excerpt: "",
    author: { handle: "a", isPluclair: false },
    gone,
    createdAt: "2026-11-01T10:00:00Z",
    lastActivityAt: "2026-11-02T10:00:00Z",
    replyCount: 1,
    solved: false,
    usefulCount: 0,
  } as unknown as EntraidePostSummary;
}

async function threadUrls(): Promise<string[]> {
  const { default: sitemap } = await import("./sitemap");
  return (await sitemap())
    .map((entry) => entry.url)
    .filter((url) => /\/blog\/entraide\/\d+-/.test(url));
}

describe("sitemap: Entraide threads", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://pluclair.com");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon");
    readEntraideList.mockReset();
  });

  it("lists every thread still there, page after page", async () => {
    const first = Array.from({ length: 50 }, (_, i) => post(i + 1, i === 3));
    readEntraideList
      .mockResolvedValueOnce(first)
      .mockResolvedValueOnce([post(51)]);
    const urls = await threadUrls();
    expect(readEntraideList).toHaveBeenCalledTimes(2);
    expect(urls).toHaveLength(50);
    expect(urls).toContain("https://pluclair.com/blog/entraide/51-question-51");
    expect(urls).not.toContain(
      "https://pluclair.com/blog/entraide/4-question-4",
    );
  });

  it("still answers, without threads, when the list cannot be read", async () => {
    readEntraideList.mockRejectedValue(new Error("down"));
    const { default: sitemap } = await import("./sitemap");
    const entries = await sitemap();
    expect(entries.some((entry) => entry.url === "https://pluclair.com/")).toBe(
      true,
    );
    expect(await threadUrls()).toEqual([]);
  });
});

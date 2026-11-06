import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
// Vitest cannot compile the MDX guides; their details are what is listed.
vi.mock("@/lib/guides", () => ({
  allGuides: async () => [
    {
      slug: "bilan-du-mois",
      meta: { title: "Le bilan du mois", description: "Ce qu'il dit." },
    },
  ],
}));

describe("/llms.txt", () => {
  it("names the site, its features and its guides, at their addresses", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://pluclair.com");
    const { GET } = await import("./route");
    const response = await GET();
    expect(response.headers.get("Content-Type")).toContain("text/markdown");
    const text = await response.text();
    if (process.env.PRINT_LLMS) {
      console.log(text);
    }
    expect(text.startsWith("# Pluclair\n\n> ")).toBe(true);
    expect(text).toContain(
      "[Le point](https://pluclair.com/fonctionnalites/le-point)",
    );
    expect(text).toContain("https://pluclair.com/blog/bilan-du-mois");
    expect(text).not.toContain("/features/");
  });
});

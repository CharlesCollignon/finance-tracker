import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { GUIDE_SLUGS } from "./guide-list";

/** Words a reader reads: the text, without the code around it. */
function readableWords(source: string): number {
  const text = source
    .replace(/^export const metadata = \{[\s\S]*?\n\};\n/m, "")
    .replace(/<(Calc|Envelopes|Sources)[\s\S]*?\/>/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/def="[^"]*"/g, " ");
  return text.split(/\s+/).filter((word) => /[\p{L}\d]/u.test(word)).length;
}

describe("the guides", () => {
  for (const slug of GUIDE_SLUGS) {
    const source = readFileSync(
      join(__dirname, "..", "content", "guides", `${slug}.mdx`),
      "utf8",
    );

    it(`${slug} says what it is, and how long it takes`, () => {
      expect(source).toMatch(/^export const metadata = \{/);
      for (const field of [
        "title",
        "description",
        "rubrique",
        "published",
        "updated",
        "minutes",
      ]) {
        expect(source).toContain(`${field}:`);
      }
      const minutes = Number(/minutes: (\d+)/.exec(source)?.[1]);
      // About 200 words a minute, read rather than skimmed.
      expect(
        Math.abs(minutes - Math.ceil(readableWords(source) / 200)),
      ).toBeLessThanOrEqual(1);
    });

    it(`${slug} never puts a breaking space before French punctuation`, () => {
      const prose = source.replace(
        /^export const metadata = \{[\s\S]*?\n\};\n/m,
        "",
      );
      expect(prose).not.toMatch(/[^\s ] [:;?!]/u);
    });
  }
});

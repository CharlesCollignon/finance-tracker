import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Every `--shadow-*` token is `none`, so a `shadow-lg` draws nothing — and
 * worse than nothing: Tailwind composes it into one `box-shadow` list with
 * the element's rings, and `none` inside a list makes the whole declaration
 * invalid. Twelve of these sat in the tree, four of them silently erasing a
 * ring, two of those the keyboard's focus ring. An edge here is a hairline,
 * a surface step or a heavier glass weight (`lib/glass.ts`), never a shadow.
 */

const ROOT = join(__dirname, "..");
// Sized only: a bare `shadow` is also a word in the landing's shaders.
const SHADOW =
  /(?:^|[\s"'`:])shadow-(?:2xs|xs|sm|md|lg|xl|2xl|inner)(?:\/\d+)?(?=[\s"'`]|$)/m;
const SHADOW_COLOR =
  /(?:^|[\s"'`:])shadow-(?:black|white|foreground|background)\b/m;

function sources(dir: string): string[] {
  return readdirSync(join(ROOT, dir), { recursive: true, encoding: "utf8" })
    .filter((path) => /\.tsx?$/.test(path) && !/\.test\.tsx?$/.test(path))
    .map((path) => join(dir, path));
}

describe("shadows", () => {
  const files = ["app", "components", "lib"].flatMap(sources);

  it("finds the sources it checks", () => {
    expect(files.length).toBeGreaterThan(100);
  });

  it("are asked for nowhere", () => {
    const offenders = files.filter((file) => {
      // Comments may say the word; only class strings are checked.
      const code = readFileSync(join(ROOT, file), "utf8")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/\/\/.*$/gm, "")
        .replace(/\{\/\*[\s\S]*?\*\/\}/g, "");
      return SHADOW.test(code) || SHADOW_COLOR.test(code);
    });
    expect(offenders).toEqual([]);
  });
});

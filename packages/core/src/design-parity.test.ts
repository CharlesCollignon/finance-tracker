import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The web and the phone keep their design tokens in three places — the web's
 * `globals.css`, the phone's `global.css` (channels, for Tailwind's alpha
 * modifiers) and the phone's `theme/tokens.ts` (for call sites a class cannot
 * reach). They had drifted apart before; this fails the moment one of them
 * moves without the others, value by value.
 */

const ROOT = join(__dirname, "..", "..", "..");
const read = (path: string) => readFileSync(join(ROOT, path), "utf8");

const webCss = read("apps/web/app/globals.css");
const phoneCss = read("apps/mobile/src/global.css");
const phoneTokens = read("apps/mobile/src/theme/tokens.ts");

/** `--name: value;` declarations, first one wins (the dark `:root` block). */
function cssVars(css: string): Map<string, string> {
  const vars = new Map<string, string>();
  for (const match of css.matchAll(/--([a-z0-9-]+):\s*([^;]+);/g)) {
    if (!vars.has(match[1]!)) {
      vars.set(match[1]!, match[2]!.trim());
    }
  }
  return vars;
}

/** "#e0be7a" or "rgba(236, 236, 241, 0.1)" as "224 190 122". */
function channels(value: string): string {
  const hex = /^#([0-9a-f]{6})$/i.exec(value);
  if (hex) {
    const n = parseInt(hex[1]!, 16);
    return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`;
  }
  const rgba = /^rgba?\(([^)]+)\)$/.exec(value.replace(/\s+/g, ""));
  if (rgba) {
    return rgba[1]!.split(",").slice(0, 3).join(" ");
  }
  return value;
}

/** The `COLORS` object of `theme/tokens.ts`, keyed in the CSS's kebab-case. */
function tokenColors(source: string): Map<string, string> {
  const block = /export const COLORS = \{([\s\S]*?)\} as const;/.exec(source);
  const colors = new Map<string, string>();
  for (const match of block?.[1]?.matchAll(/(\w+):\s*"([^"]+)"/g) ?? []) {
    const kebab = match[1]!.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
    colors.set(kebab, match[2]!);
  }
  return colors;
}

const web = cssVars(webCss);
const phone = cssVars(phoneCss);
const tokens = tokenColors(phoneTokens);

describe("design tokens, web against phone", () => {
  it("finds the palettes it compares", () => {
    expect(phone.size).toBeGreaterThan(20);
    expect(tokens.size).toBeGreaterThan(20);
  });

  it("gives every colour the phone defines the web's value", () => {
    for (const [name, value] of phone) {
      expect(web.has(name), `--${name} is missing on the web`).toBe(true);
      expect(value, `--${name}`).toBe(channels(web.get(name)!));
    }
  });

  it("keeps tokens.ts in step with the same palette", () => {
    for (const [name, value] of tokens) {
      expect(web.has(name), `${name} is missing on the web`).toBe(true);
      expect(channels(value), name).toBe(channels(web.get(name)!));
    }
  });

  it("uses the same radii and spacing", () => {
    expect(web.get("radius-card")).toBe("20px");
    expect(web.get("radius-shell")).toBe("26px");
    expect(web.get("spacing-card")).toBe("20px");
    expect(web.get("spacing-row")).toBe("12px");
    const radius =
      /export const RADIUS = \{([\s\S]*?)\}/.exec(phoneTokens)?.[1] ?? "";
    expect(radius).toMatch(/control:\s*10\b/);
    expect(radius).toMatch(/card:\s*20\b/);
    expect(radius).toMatch(/shell:\s*26\b/);
  });
});

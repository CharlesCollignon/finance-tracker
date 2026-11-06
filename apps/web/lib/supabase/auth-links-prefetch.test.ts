import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Reaching /signup or /login ends a demo session (`middleware.ts`), so a link
 * to either must never be prefetched: Next prefetches a link as soon as it is
 * on screen, the prefetch passes through the proxy like a visit, and the demo
 * banner's « Créer mon compte » signed every demo visitor out a few seconds
 * after they arrived (2026-11-06). The proxy cannot tell the two apart — Next
 * strips `next-router-prefetch` from the headers it sees — so the rule is
 * held at the links instead, by this test.
 */

const WEB = join(__dirname, "..", "..");

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (name === "node_modules" || name.startsWith(".")) {
      return [];
    }
    if (statSync(path).isDirectory()) {
      return sources(path);
    }
    return path.endsWith(".tsx") ? [path] : [];
  });
}

describe("links to /signup and /login", () => {
  it("are never prefetched", () => {
    const offenders: string[] = [];
    for (const file of [
      ...sources(join(WEB, "components")),
      ...sources(join(WEB, "app")),
    ]) {
      const text = readFileSync(file, "utf8");
      for (const match of text.matchAll(/<Link\b[^>]*>/g)) {
        const tag = match[0];
        if (
          /href="\/(signup|login)"/.test(tag) &&
          !/prefetch=\{false\}/.test(tag)
        ) {
          offenders.push(`${relative(WEB, file)}: ${tag.slice(0, 80)}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});

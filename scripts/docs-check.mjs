#!/usr/bin/env node
/**
 * The docs keep up with the code: `pnpm check:docs`, run in CI.
 *
 * `docs/feature-map.md` lists every web page, every web route handler, every
 * phone screen and every migration between `<!-- docs-check:<list> -->` and
 * `<!-- /docs-check -->` markers. This compares each list with the files, in
 * both directions: something added without its line fails, and so does a
 * line left behind after a removal. Only the first `code span` of each line
 * counts, so the rest of the line is free prose.
 *
 *   node scripts/docs-check.mjs
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const MAP = "docs/feature-map.md";

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) out.push(...walk(path));
    else out.push(path);
  }
  return out;
}

/** `(app)/(ledger)/calendar` → `/calendar`; route groups are not in a URL. */
function webPath(dir) {
  const parts = dir.split(sep).filter((part) => part && !/^\(.*\)$/.test(part));
  return `/${parts.join("/")}`;
}

function webEntries(fileName) {
  const app = join(ROOT, "apps/web/app");
  return walk(app)
    .filter((file) => file.endsWith(`${sep}${fileName}`))
    .map((file) => webPath(relative(app, file).slice(0, -fileName.length)));
}

const webPages = () => [...webEntries("page.tsx"), ...webEntries("page.mdx")];
const webRoutes = () => [...webEntries("route.ts"), ...webEntries("route.tsx")];

function phoneScreens() {
  const app = join(ROOT, "apps/mobile/src/app");
  return walk(app)
    .map((file) => relative(app, file).split(sep).join("/"))
    .filter((file) => file.endsWith(".tsx"))
    .filter((file) => !/(^|\/)(_layout|\+[^/]*)\.tsx$/.test(file))
    .map((file) => file.slice(0, -".tsx".length));
}

function migrations() {
  return readdirSync(join(ROOT, "supabase/migrations"))
    .filter((name) => name.endsWith(".sql"))
    .map((name) => name.slice(0, -".sql".length));
}

const LISTS = {
  "web-pages": webPages,
  "web-routes": webRoutes,
  "phone-screens": phoneScreens,
  migrations,
};

/** The first code span of each line between a list's markers. */
function documented(text, list) {
  const start = text.indexOf(`<!-- docs-check:${list} -->`);
  if (start === -1) return null;
  const end = text.indexOf("<!-- /docs-check -->", start);
  return text
    .slice(start, end === -1 ? undefined : end)
    .split("\n")
    .slice(1)
    .map((line) => /`([^`]+)`/.exec(line)?.[1])
    .filter((entry) => entry !== undefined);
}

const text = readFileSync(join(ROOT, MAP), "utf8");
const problems = [];

for (const [list, read] of Object.entries(LISTS)) {
  const inDocs = documented(text, list);
  if (inDocs === null) {
    problems.push(`${MAP}: no <!-- docs-check:${list} --> section`);
    continue;
  }
  const inCode = new Set(read());
  const listed = new Set(inDocs);
  for (const entry of [...inCode].sort()) {
    if (!listed.has(entry)) {
      problems.push(`${list}: \`${entry}\` exists but is not in ${MAP}`);
    }
  }
  for (const entry of [...listed].sort()) {
    if (!inCode.has(entry)) {
      problems.push(`${list}: \`${entry}\` is in ${MAP} but not in the code`);
    }
  }
}

if (problems.length > 0) {
  console.error(problems.join("\n"));
  console.error(
    `\n${problems.length} difference(s). Update ${MAP} in the same branch (see AGENTS.md « Keeping the docs true »).`,
  );
  process.exit(1);
}
console.log(`${MAP} matches the code.`);

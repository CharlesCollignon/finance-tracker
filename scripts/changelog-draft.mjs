#!/usr/bin/env node
/**
 * What has landed on `main` since the newest « Nouveautés » entry, to write
 * the next ones from.
 *
 *   node scripts/changelog-draft.mjs
 *
 * Prints each merge since that entry's date with the commits it brought, the
 * commits made on `main` directly, and the figures `CHANGELOG_STATS` states
 * (`packages/core/src/changelog-entries.ts`), counted here because a build's
 * shallow clone cannot. It writes nothing: an entry is words for the people
 * who use the app, which a commit subject is not.
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const entries = readFileSync(
  join(root, "packages/core/src/changelog-entries.ts"),
  "utf8",
);
const newest = /date: "(\d{4}-\d{2}-\d{2})"/.exec(entries)?.[1];
if (!newest) {
  console.error("No dated entry found in changelog-entries.ts.");
  process.exit(1);
}

const git = (...args) =>
  execFileSync("git", args, { cwd: root, encoding: "utf8" }).trimEnd();

// From the newest entry's own day: a merge later that day is not in it yet.
const since = `${newest} 00:00`;

console.log(`Newest entry: ${newest}\n`);
console.log("Merges into main since then:\n");
const merges = git(
  "log",
  "main",
  "--merges",
  "--first-parent",
  `--since=${since}`,
  "--reverse",
  "--format=%H %ad %s",
  "--date=short",
);
for (const line of merges ? merges.split("\n") : []) {
  const [hash, date, ...subject] = line.split(" ");
  console.log(`## ${date} ${subject.join(" ")}`);
  const commits = git("log", "--format=  - %s", `${hash}^1..${hash}^2`);
  console.log(commits || "  (no commits)");
}

console.log("\nCommits made on main directly since then:\n");
console.log(
  git(
    "log",
    "main",
    "--no-merges",
    "--first-parent",
    `--since=${since}`,
    "--reverse",
    "--format=  - %ad %s",
    "--date=short",
  ) || "  (none)",
);

console.log("\nFor CHANGELOG_STATS:\n");
console.log(`  commits: ${git("rev-list", "--count", "main")},`);
console.log(
  `  asOf: "${git("log", "-1", "--format=%ad", "--date=short", "main")}",`,
);

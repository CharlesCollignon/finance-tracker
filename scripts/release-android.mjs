#!/usr/bin/env node
/**
 * A new Android APK, from `main` to the site, in one command:
 *
 *   node scripts/release-android.mjs            # 1.0.0 → 1.1.0
 *   node scripts/release-android.mjs patch      # 1.0.0 → 1.0.1
 *   node scripts/release-android.mjs --dry-run  # say what it would do
 *   node scripts/release-android.mjs --draft    # build it, publish later
 *
 * `--draft` stages the release unpublished: invisible to anyone else, and
 * to the site, which only reads published releases. Publish it with
 * `gh release edit android-<version> --draft=false --latest` — for now
 * after the legal pages are final (docs/store/README.md, « Before the
 * public download »).
 *
 * 1. Raises `version` in `apps/mobile/app.json` — what the app compares
 *    against the site's to offer a newer APK — and commits it.
 * 2. Builds the APK on EAS (`preview` profile, which raises the build
 *    number by itself), and waits for it.
 * 3. Pushes `main`, and publishes the APK as the GitHub release
 *    `android-<version>`, named `pluclair.apk`, notes taken from the
 *    phone's « Nouveautés » entries since the release before.
 *
 * Nothing to change on Vercel afterwards: `ANDROID_APK_URL` points at the
 * latest release's file, and the site reads the version from its tag
 * (`latestApkVersion`, apps/web/lib/store-links.ts). The entries themselves
 * are written with the changes, before, as always (`AGENTS.md`).
 *
 * Needs a clean `main` up to date with origin, `gh` signed in and `eas`
 * signed in to the project's account.
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const appJsonPath = join(root, "apps/mobile/app.json");
const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const draft = args.includes("--draft");
const bump =
  args.find((arg) => ["major", "minor", "patch"].includes(arg)) ?? "minor";

function run(command, commandArgs, options = {}) {
  return execFileSync(command, commandArgs, {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
    ...options,
  }).trim();
}

function fail(message) {
  console.error(`\n✗ ${message}`);
  process.exit(1);
}

function next(version, part) {
  const [major = 0, minor = 0, patch = 0] = version.split(".").map(Number);
  if (part === "major") return `${major + 1}.0.0`;
  if (part === "minor") return `${major}.${minor + 1}.0`;
  return `${major}.${minor}.${patch + 1}`;
}

// --------------------------------------------------------------- preflight
if (run("git", ["rev-parse", "--abbrev-ref", "HEAD"]) !== "main") {
  fail("Run it from main.");
}
if (run("git", ["status", "--porcelain"])) {
  fail("The working tree has changes; commit or put them away first.");
}
run("git", ["fetch", "-q", "origin", "main"]);
if (
  run("git", ["rev-parse", "HEAD"]) !== run("git", ["rev-parse", "origin/main"])
) {
  fail("main is not the same as origin/main; pull or push first.");
}

const appJson = JSON.parse(readFileSync(appJsonPath, "utf8"));
const current = appJson.expo.version;
const version = next(current, bump);
const tag = `android-${version}`;

// The release before, for the notes: its day, or none for the first — and
// what its notes already said, since an entry written the day of a release
// may have gone out with it.
let since = null;
let saidBefore = "";
try {
  const before = JSON.parse(
    run("gh", ["release", "view", "--json", "tagName,publishedAt,body"], {
      stdio: ["ignore", "pipe", "ignore"],
    }),
  );
  since = before.publishedAt.slice(0, 10);
  saidBefore = before.body ?? "";
} catch {
  // No release yet: the notes list the latest changes instead.
}

const { CHANGELOG } = await import(
  join(root, "packages/core/src/changelog-entries.ts")
);
const forPhone = CHANGELOG.filter((entry) => entry.platforms.includes("phone"));
const shipped = since
  ? forPhone.filter(
      (entry) =>
        entry.date >= since && !saidBefore.includes(`- ${entry.fr.title} — `),
    )
  : forPhone.slice(0, 10);
const notes = [
  `Pluclair ${version} pour Android.`,
  "",
  ...(shipped.length
    ? shipped.map((entry) => `- ${entry.fr.title} — ${entry.fr.body}`)
    : ["- Corrections et améliorations."]),
  "",
  "Tout ce qui change : https://pluclair.com/nouveautes",
].join("\n");

console.log(`Android ${current} → ${version} (${tag})\n\n${notes}\n`);
if (dryRun) {
  console.log("Dry run: nothing changed.");
  process.exit(0);
}

// ----------------------------------------------------------------- version
appJson.expo.version = version;
writeFileSync(appJsonPath, `${JSON.stringify(appJson, null, 2)}\n`);
run("git", ["add", "apps/mobile/app.json"]);
run("git", [
  "commit",
  "-q",
  "-m",
  `Android ${version}`,
  "-m",
  "The version the app compares against the site's to offer a newer APK.",
  "-m",
  "Changelog: none",
]);
// The release points here, whatever is checked out by the time the build
// is done.
const releaseSha = run("git", ["rev-parse", "HEAD"]);

// ------------------------------------------------------------------- build
console.log("Building on EAS — this takes a while…");
let buildUrl;
try {
  const builds = JSON.parse(
    run(
      "npx",
      [
        "--no-install",
        "eas",
        "build",
        "--platform",
        "android",
        "--profile",
        "preview",
        "--non-interactive",
        "--wait",
        "--json",
      ],
      { cwd: join(root, "apps/mobile"), maxBuffer: 64 * 1024 * 1024 },
    ),
  );
  buildUrl = builds[0]?.artifacts?.buildUrl;
} catch {
  fail(
    `The build failed. The version commit is local only: undo it with\n  git reset --hard HEAD~1`,
  );
}
if (!buildUrl) {
  fail("EAS finished without an APK to download.");
}

// ----------------------------------------------------------------- publish
const folder = mkdtempSync(join(tmpdir(), "pluclair-apk-"));
const apk = join(folder, "pluclair.apk");
// A few tries: a hundred-odd megabytes over WSL's network can be cut off
// half way (ECONNRESET), and the build is done — only the copy is missing.
let downloaded = false;
for (let attempt = 1; attempt <= 5 && !downloaded; attempt++) {
  try {
    const response = await fetch(buildUrl);
    if (!response.ok) {
      throw new Error(String(response.status));
    }
    writeFileSync(apk, Buffer.from(await response.arrayBuffer()));
    downloaded = true;
  } catch (error) {
    console.error(`Download try ${attempt} failed (${error.message}).`);
    await new Promise((resolve) => setTimeout(resolve, attempt * 5000));
  }
}
if (!downloaded) {
  fail(
    `Could not download the APK from ${buildUrl}. The build is done and the\n` +
      `version commit is local: download it by hand, then publish it with\n` +
      `  gh release create ${tag} pluclair.apk --target ${releaseSha}${draft ? " --draft" : ""}`,
  );
}

run("git", ["push", "-q", "origin", "main"]);
const notesPath = join(folder, "notes.md");
writeFileSync(notesPath, notes);
run("gh", [
  "release",
  "create",
  tag,
  apk,
  "--title",
  `Pluclair Android ${version}`,
  "--notes-file",
  notesPath,
  "--target",
  releaseSha,
  ...(draft ? ["--draft"] : []),
]);

if (draft) {
  console.log(
    `\n✓ ${tag} is staged as a draft. Publish it with\n` +
      `  gh release edit ${tag} --draft=false --latest`,
  );
  process.exit(0);
}
console.log(`\n✓ ${tag} is published.`);
console.log(
  "The site offers it as soon as ANDROID_APK_URL points at\n" +
    "  https://github.com/CharlesCollignon/finance-tracker/releases/latest/download/pluclair.apk\n" +
    "(set once on Vercel); older APKs see the new version within ten minutes.",
);

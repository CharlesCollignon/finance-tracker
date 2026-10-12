#!/usr/bin/env node
/**
 * « Nouveautés » never falls behind: a Claude Code PreToolUse hook
 * (`.claude/settings.json`) run before a Bash command that merges into
 * `main` or pushes `main`.
 *
 * It reads the hook's JSON on stdin. When the work coming in changes what
 * someone using Pluclair can see or get — the apps, the shared packages,
 * the migrations — and does not touch
 * `packages/core/src/changelog-entries.ts`, the command is refused with a
 * reminder to write its entry. A change nobody sees says so on purpose,
 * with a `Changelog:` line (`Changelog: none`, or where its entry is) in
 * one of its commits or in the merge's own message.
 *
 * Anything else — another command, a branch push, a git it cannot read —
 * passes untouched: a guard that fails closed on its own bugs would only
 * be switched off.
 *
 *   echo '{"tool_input":{"command":"git merge --no-ff topic"}}' | node scripts/changelog-guard.mjs
 */
import { execFileSync } from "node:child_process";

const ENTRIES = "packages/core/src/changelog-entries.ts";

/** Where a change can reach someone using the app. */
const USER_FACING = [
  "apps/web/app/",
  "apps/web/components/",
  "apps/web/lib/",
  "apps/mobile/src/",
  "packages/core/src/",
  "packages/data/src/",
  "supabase/migrations/",
];

/** Tests, and the changelog's own files, change nothing anyone sees. */
function userFacing(path) {
  return (
    USER_FACING.some((prefix) => path.startsWith(prefix)) &&
    !/\.test\.[cm]?[jt]sx?$/.test(path) &&
    !path.startsWith("packages/core/src/changelog")
  );
}

function git(...args) {
  return execFileSync("git", args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  }).trim();
}

/** Words of one shell command, quotes taken off; good enough for git's. */
function words(command) {
  const out = [];
  const pattern = /"((?:[^"\\]|\\.)*)"|'([^']*)'|(\S+)/g;
  for (const match of command.matchAll(pattern)) {
    out.push(match[1] ?? match[2] ?? match[3]);
  }
  return out;
}

/** Each simple command in a compound one (`a && b; c | d`). */
function commands(line) {
  return line
    .split(/&&|\|\||;|\|/)
    .map((part) => words(part.trim()))
    .filter((argv) => argv.length > 0);
}

/** Merge targets and the messages given with -m, from `git merge …`. */
function mergeOf(argv) {
  const at = argv.indexOf("merge");
  if (argv[0] !== "git" || at !== 1) {
    return null;
  }
  const targets = [];
  const messages = [];
  for (let i = 2; i < argv.length; i++) {
    const word = argv[i];
    if (word === "-m" || word === "--message") {
      messages.push(argv[++i] ?? "");
    } else if (word.startsWith("--message=")) {
      messages.push(word.slice("--message=".length));
    } else if (["--abort", "--continue", "--quit"].includes(word)) {
      return null;
    } else if (!word.startsWith("-")) {
      targets.push(word);
    }
  }
  return { targets, messages };
}

/** Whether `git push …` would send `main`. */
function pushesMain(argv, branch) {
  if (argv[0] !== "git" || argv[1] !== "push") {
    return false;
  }
  const refs = argv.slice(2).filter((word) => !word.startsWith("-"));
  // `git push`, `git push origin`: the current branch.
  if (refs.length <= 1) {
    return branch === "main";
  }
  return refs
    .slice(1)
    .some(
      (ref) =>
        ref === "main" ||
        ref.endsWith(":main") ||
        (ref === "HEAD" && branch === "main"),
    );
}

/** The branch a `git switch x` / `git checkout x` moves to, if it is one. */
function switchedTo(argv) {
  if (argv[0] !== "git" || !["switch", "checkout"].includes(argv[1])) {
    return null;
  }
  const rest = argv.slice(2).filter((word) => !word.startsWith("-"));
  return rest.length === 1 ? rest[0] : null;
}

/**
 * Why `range` (`a..b`) needs a « Nouveautés » entry it does not have, or
 * null when it has one, needs none, or says so.
 */
function missingEntry(range, messages = []) {
  const [base, tip] = range.split("..");
  const files = git("diff", "--name-only", `${base}...${tip}`)
    .split("\n")
    .filter(Boolean);
  if (files.includes(ENTRIES)) {
    return null;
  }
  const seen = files.filter(userFacing);
  if (seen.length === 0) {
    return null;
  }
  const log = git("log", "--format=%B", range);
  if (
    /^Changelog:/im.test(log) ||
    messages.some((m) => /^Changelog:/im.test(m))
  ) {
    return null;
  }
  return seen;
}

function deny(reason) {
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "deny",
        permissionDecisionReason: reason,
      },
    }),
  );
}

function reminder(what, files) {
  const listed = files.slice(0, 8).join(", ") + (files.length > 8 ? ", …" : "");
  return (
    `« Nouveautés » would fall behind: ${what} changes what users see (${listed}) ` +
    `and adds no entry to ${ENTRIES}. Write its entry (French and English, dated ` +
    `the day it reaches main; \`node scripts/changelog-draft.mjs\` lists what landed, ` +
    `\`--stats\` updates CHANGELOG_STATS), or, if nobody can see the change, say so ` +
    `with a \`Changelog: none\` line in a commit or in the merge message.`
  );
}

function main(input) {
  const command = JSON.parse(input)?.tool_input?.command;
  if (typeof command !== "string") {
    return;
  }
  // Followed through the command, so `git switch main && git merge x` is
  // read as a merge into main.
  let branch = git("rev-parse", "--abbrev-ref", "HEAD");
  for (const argv of commands(command)) {
    branch = switchedTo(argv) ?? branch;
    const merge = mergeOf(argv);
    if (merge && branch === "main") {
      for (const target of merge.targets) {
        const files = missingEntry(`main..${target}`, merge.messages);
        if (files) {
          deny(reminder(`merging ${target}`, files));
          return;
        }
      }
    }
    if (pushesMain(argv, branch)) {
      const files = missingEntry("origin/main..main");
      if (files) {
        deny(reminder("pushing main", files));
        return;
      }
    }
  }
}

let input = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => (input += chunk));
process.stdin.on("end", () => {
  try {
    main(input);
  } catch {
    // Unreadable input or a git that cannot answer: let the command run.
  }
});

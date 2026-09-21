import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { en } from "./messages/en";
import type { MessageTree } from "./t";

/**
 * Copy nothing reads.
 *
 * `en.ts` is the schema and `fr.ts` is `typeof en`, so a *missing* French
 * string is already a type error. The opposite — a key both languages still
 * carry that no screen asks for any more — is invisible to every other gate in
 * the repo, for the same reason an orphaned component was: nothing is wrong
 * with it, it simply cannot be reached. This branch deleted two of them by
 * hand (`common.walkMeThrough`, `common.trendRange`, both left behind when the
 * Month screen went) and nothing would have caught a third.
 *
 * So this is the i18n half of `pnpm check:reachability`. knip walks the import
 * graph; a message key is not in the import graph — it is a string — so this
 * walks the source text instead.
 *
 * ## What it can see, and what it cannot
 *
 * Keys reach `t()` three ways in this codebase, and the scan below is built
 * around all three:
 *
 * 1. **Written at the call site** — `t("month.actionClose")`. 1,600-odd of
 *    these. Found by matching the quoted literal.
 * 2. **Carried in data** — `labelKey: "nav.ledger"` in
 *    `apps/web/lib/navigation.ts`, `messageKey: "month.attentionInbox"` in
 *    `attention.ts`, and every Zod message in `validations/` (a schema is
 *    built at module load, before any request has a language, so it emits a
 *    key and the toast resolves it). These are still quoted literals, just not
 *    next to a `t(`, which is why the scan looks for the literal anywhere in
 *    the file rather than for a call shape.
 * 3. **Assembled from a prefix** — ``t(`recurring.${value}`)`` in
 *    `RecurringForm.tsx` and `RecurringFormModal.tsx`. The suffix is a
 *    variable, so the whole `recurring.*` subtree has to be treated as
 *    reached.
 *
 * That third case is the honest limit of this test, and it cuts both ways: a
 * genuinely dead key that happens to sit under a dynamically-built prefix will
 * not be reported, because from the outside it is indistinguishable from one
 * the running app asks for. Two other blind spots worth naming:
 *
 * - A key built from pieces that are not literals at all (concatenated from
 *   two variables, read out of the database, sent down in a push payload)
 *   cannot be seen from here. There are none today; if one is added, it will
 *   show up as a false positive in this test rather than as a silent hole,
 *   which is the right way round.
 * - Only the trees in `SCAN_ROOTS` are read. A key referenced from somewhere
 *   else in the repo would read as unused.
 *
 * What it does *not* claim to check is the reverse direction — a key that is
 * referenced but missing. That one is already a type error, twice over:
 * `Key` is a union of every dotted path in `en`, and `fr` is annotated
 * `Messages`.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, "..", "..", "..", "..");

/**
 * Where a key can be referenced from.
 *
 * Both clients and the library itself. The library is in the list because
 * `attention.ts`, `month-facts.ts` and the `validations/` schemas all carry
 * keys as data.
 */
const SCAN_ROOTS = ["apps/web", "apps/mobile/src", "packages/core/src"];

const SCAN_EXTENSIONS = [".ts", ".tsx", ".js", ".jsx", ".mjs"];

const SKIP_DIRECTORIES = new Set([
  "node_modules",
  ".next",
  ".expo",
  "dist",
  "build",
  "coverage",
  ".turbo",
]);

/**
 * Files whose mention of a key does not count as using it.
 *
 * `en.ts` defines every key and `fr.ts` repeats every key, so scanning either
 * would mark the whole catalogue as referenced by itself.
 *
 * This file is on the list for the same reason, and the reason is not
 * theoretical: `KNOWN_DEAD_KEYS` below spells out thirty keys in full, so
 * without this line the debt list would keep itself alive — every key on it
 * would read as referenced, the staleness check would flag all thirty, and
 * the whole mechanism would invert.
 */
const SELF_REFERENTIAL_FILES = new Set([
  join("packages", "core", "src", "i18n", "messages", "en.ts"),
  join("packages", "core", "src", "i18n", "messages", "fr.ts"),
  join("packages", "core", "src", "i18n", "unused-keys.test.ts"),
]);

/**
 * A plural message, by the same rule the `Key` type uses.
 *
 * Note that this is stricter than `isPluralMessage` in `./t`, which asks only
 * for a string `other` — and it has to be. `PluralMessage` requires both `one`
 * and `other`, so `MessageKey` only stops descending when both are there. The
 * looser test would read the `allocation` group as a plural message on the
 * strength of its `allocation.other` ("Other", the catch-all category) and
 * hide its eight siblings from this scan.
 */
function isPluralMessage(value: unknown): boolean {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  const candidate = value as { one?: unknown; other?: unknown };
  return (
    typeof candidate.one === "string" && typeof candidate.other === "string"
  );
}

/** Every dotted path in the catalogue that reaches a message. */
function collectKeys(tree: MessageTree, prefix = ""): string[] {
  const keys: string[] = [];

  for (const [segment, value] of Object.entries(tree)) {
    const path = prefix ? `${prefix}.${segment}` : segment;
    if (typeof value === "string" || isPluralMessage(value)) {
      keys.push(path);
    } else {
      keys.push(...collectKeys(value as MessageTree, path));
    }
  }

  return keys;
}

function sourceFiles(root: string): string[] {
  const found: string[] = [];

  const walk = (directory: string) => {
    for (const item of readdirSync(directory, { withFileTypes: true })) {
      if (item.isDirectory()) {
        if (!SKIP_DIRECTORIES.has(item.name)) {
          walk(join(directory, item.name));
        }
        continue;
      }
      if (!SCAN_EXTENSIONS.some((extension) => item.name.endsWith(extension))) {
        continue;
      }
      const path = join(directory, item.name);
      if (SELF_REFERENTIAL_FILES.has(relative(REPO_ROOT, path))) {
        continue;
      }
      found.push(path);
    }
  };

  walk(join(REPO_ROOT, root));
  return found;
}

/**
 * Anything inside quotes, and any template literal that stops at a `${`.
 *
 * Deliberately blunt. It does not try to tell a message key from a CSS class
 * or a column name: an accidental collision can only make a dead key look
 * alive, and a key-shaped string that is not a key costs nothing.
 */
const QUOTED = /"([^"\n\\]*)"|'([^'\n\\]*)'/g;
const TEMPLATE_PREFIX = /`([^`\n$\\]*)\$\{/g;

interface References {
  literals: Set<string>;
  prefixes: Set<string>;
}

function collectReferences(): References {
  const literals = new Set<string>();
  const prefixes = new Set<string>();

  for (const root of SCAN_ROOTS) {
    for (const file of sourceFiles(root)) {
      const source = readFileSync(file, "utf8");

      for (const match of source.matchAll(QUOTED)) {
        const value = match[1] ?? match[2];
        if (value) {
          literals.add(value);
        }
      }

      for (const match of source.matchAll(TEMPLATE_PREFIX)) {
        // Only a prefix that already names a group is interesting — a bare
        // `${...}` at the start of a template could match every key there is.
        const prefix = match[1];
        if (prefix?.endsWith(".")) {
          prefixes.add(prefix);
        }
      }
    }
  }

  return { literals, prefixes };
}

/**
 * DEBT — dead copy this check found on its first run, left in place.
 *
 * Twenty-nine keys in both languages that no screen asks for. They are
 * recorded rather than deleted because deleting product copy is the owner's
 * call and because two of them read like a screen that was planned and never
 * built rather than one that was retired — `month.setUp*` and the sixteen
 * `lookThrough.*` entries, which describe a look-through view richer than the
 * one `LookThroughView.tsx` actually renders.
 *
 * It was thirty. `bearing.pinned` ("Moved by you", the label on a tile the
 * reader had dragged) left with the arranger it belonged to, and its line
 * here left in the same commit — which is exactly the shrinking this comment
 * asks for.
 *
 * **This list is meant to shrink, and it cannot silently grow stale.** An
 * entry that no longer names an unused key fails the test below just as
 * loudly as a new dead key does: delete the copy from `en.ts` and `fr.ts` and
 * you must delete its line here in the same commit.
 */
const KNOWN_DEAD_KEYS: readonly string[] = [
  // Left behind by the Month screen's retirement, alongside the two this
  // branch already removed by hand (`common.walkMeThrough`,
  // `common.trendRange`).
  "month.setUpTitle",
  "month.setUpBody",
  "month.setUpCharges",
  "month.capsAndGoals",
  "month.moreThisMonth",
  "month.startingBalanceHint",
  "month.nothingToApply",
  "common.chartMode",
  "common.unrealisedProfitLoss",
  "common.needsYou",

  // Copy for a look-through view with country/sector weights, target
  // comparison and reading freshness. `LookThroughView.tsx` uses the rest of
  // the `lookThrough` group; these particular strings it never asks for.
  "lookThrough.subtitle",
  "lookThrough.countryShare",
  "lookThrough.marketWeight",
  "lookThrough.overYears",
  "lookThrough.noChargeRecorded",
  "lookThrough.overlapAtLeast",
  "lookThrough.targetWeight",
  "lookThrough.currentWeight",
  "lookThrough.noMoveNeeded",
  "lookThrough.notRead",
  "lookThrough.notReadBody",
  "lookThrough.readOne",
  "lookThrough.lastRead",
  "lookThrough.caveats.staleReadings",

  // Strays.
  "locale.settingHint",
  "fallback.noValue",
  "walletRead.writtenInOtherLanguage",
];

describe("message catalogue", () => {
  const keys = collectKeys(en as unknown as MessageTree);
  const { literals, prefixes } = collectReferences();

  const unused = keys.filter((key) => {
    if (literals.has(key)) {
      return false;
    }
    for (const prefix of prefixes) {
      if (key.startsWith(prefix)) {
        return false;
      }
    }
    return true;
  });

  it("carries no key the apps never ask for", () => {
    const known = new Set(KNOWN_DEAD_KEYS);
    const unexpected = unused.filter((key) => !known.has(key));

    expect(
      unexpected,
      [
        `${unexpected.length} message key(s) in en.ts are referenced nowhere under ${SCAN_ROOTS.join(", ")}.`,
        "",
        "Either delete them from en.ts and fr.ts, or — if one is reached in a",
        "way this scan cannot see — say so here. What it cannot see:",
        "  - a key assembled from non-literal pieces at runtime;",
        "  - a key referenced only from outside the scanned trees;",
        "  - and note the inverse blind spot, which does not show up as a",
        "    failure: a key under a dynamically built prefix such as",
        "    `recurring.${value}` is counted as used whether or not it is.",
      ].join("\n"),
    ).toEqual([]);
  });

  it("has no stale entry in its dead-key list", () => {
    const stillDead = new Set(unused);
    const stale = KNOWN_DEAD_KEYS.filter((key) => !stillDead.has(key));

    expect(
      stale,
      [
        `${stale.length} entry(ies) in KNOWN_DEAD_KEYS no longer name an unused key.`,
        "",
        "The list is debt, not a permanent exemption. A key that has been",
        "deleted from the catalogue — or wired back up to a screen — must lose",
        "its line here, so that the list can only ever shrink.",
      ].join("\n"),
    ).toEqual([]);
  });
});

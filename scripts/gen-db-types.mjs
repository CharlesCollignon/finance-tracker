// Writes packages/core/src/types/database.generated.ts from the local
// Supabase database. Run with `pnpm gen:types` after applying a migration
// locally (`npx supabase migration up --local`).
//
// The CLI is fetched by pnpm dlx rather than installed: it ships a binary
// through a postinstall script, and the workspace runs no build scripts.
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";

const OUT = "packages/core/src/types/database.generated.ts";
const HEADER = `/**
 * Generated from the local database by \`pnpm gen:types\`. Do not edit: change
 * a migration, apply it locally, and run the script again. The columns a
 * CHECK constraint narrows are narrowed in \`./database.ts\`, which is what the
 * apps import.
 */

`;

const generated = execFileSync(
  "pnpm",
  [
    "dlx",
    "supabase@2.119.0",
    "gen",
    "types",
    "typescript",
    "--local",
    "--schema",
    "public",
  ],
  { encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] },
);

writeFileSync(OUT, HEADER + generated);
execFileSync("pnpm", ["exec", "prettier", "--write", OUT], {
  stdio: "inherit",
});

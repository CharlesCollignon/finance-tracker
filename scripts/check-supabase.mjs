#!/usr/bin/env node
/**
 * Verifies Supabase env vars and that the database schema is applied.
 * Usage: node scripts/check-supabase.mjs
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

function loadEnvLocal() {
  const path = resolve(process.cwd(), ".env.local");
  if (!existsSync(path)) {
    console.error("✗ .env.local not found");
    console.error("  Copy .env.local.example → .env.local and fill in values");
    process.exit(1);
  }

  const lines = readFileSync(path, "utf8").split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq);
    const value = trimmed.slice(eq + 1);
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

loadEnvLocal();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || url.includes("your-project") || url.includes("xxxxxxxx")) {
  console.error("✗ Set NEXT_PUBLIC_SUPABASE_URL in .env.local");
  console.error("  (replace the placeholder with your real Project URL)");
  process.exit(1);
}

if (!anonKey || anonKey.includes("your-anon-key") || anonKey.endsWith("...")) {
  console.error("✗ Set NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local");
  console.error("  (paste the full anon public key from Supabase → Settings → API)");
  process.exit(1);
}

console.log("✓ Env vars present");
console.log(`  URL: ${url}`);

const supabase = createClient(url, anonKey);

const { error } = await supabase.from("categories").select("id").limit(1);

if (error) {
  if (
    error.message.includes("relation") ||
    error.code === "PGRST205" ||
    error.message.includes("does not exist")
  ) {
    console.error("✗ Tables not found — run the migration first:");
    console.error("  supabase/migrations/001_initial.sql");
    console.error("  → Supabase Dashboard → SQL Editor → paste & run");
    process.exit(1);
  }

  console.error("✗ Supabase error:", error.message);

  if (error.message.includes("fetch failed")) {
    console.error("\n  Common causes:");
    console.error("  • URL in .env.local is still a placeholder");
    console.error("  • Typo in NEXT_PUBLIC_SUPABASE_URL");
    console.error("  • Supabase project is paused (free tier)");
    console.error("  • No network access from this machine");
  }

  process.exit(1);
}

console.log("✓ Database schema looks good (categories table exists)");
console.log("\nNext: pnpm dev → http://localhost:3000");

import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/**
 * The app's `@/` addresses, as `tsconfig.json` maps them, so a test can
 * reach a module that imports through them (the marketing copy does).
 * `include` is vitest's own default, written out so the reachability check
 * (knip) reads the tests as entries.
 */
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL(".", import.meta.url)) },
  },
  test: {
    include: ["**/*.test.{ts,tsx}"],
    exclude: ["node_modules/**", ".next/**"],
  },
});

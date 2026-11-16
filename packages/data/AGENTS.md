# `@finance/data`

The Supabase reads and writes both apps make, written once. The root
`AGENTS.md` applies too.

## Rules

- **Take the caller's client.** Every function takes `db: Db`
  (`src/client.ts`) and the `userId` (or owner id) it acts for. Never create
  a client here: the web passes its cookie client or, in a cron, the service
  role; the phone passes its own client, whose fetch tells screens what
  changed.
- **Filter on `user_id` as well as relying on RLS**, so the same call is
  right under the service role.
- **Validate input** with `@finance/core` zod schemas, and return
  `ActionResult` (`@finance/core/action-result`). Turn database errors into
  catalogue keys with `dbError` (`src/errors.ts`).
- **Page past 1,000 rows** with `allRows` (`@finance/core/paging`).
- **Survive an unapplied migration.** Test the error with `isMissingSchema`
  / `isMissingSchemaOrFunction` (`src/schema.ts`), and give the old
  behaviour or an empty result, never a crash. The hosted database can lag
  behind `main` by days. Don't write a new copy of that check.
- **Deletes are soft** (`deleted_at`) and return an undo token
  (`src/deletions.ts`). The nightly sweep removes them after 30 days.
- **Export on purpose**, as in core: list the module in `package.json`
  `exports`, in the same commit as its first reader.

## Tests

`pnpm --filter @finance/data test` runs the unit tests with a fake client.
To check a read against real tables, write a throwaway vitest file that uses
the **local** Supabase with the service role, run it, then delete it. Never
point it at the hosted project.

Which module touches which tables, and which screens use it, is listed in
`docs/feature-map.md` « Data modules ».

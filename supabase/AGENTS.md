# The database (`supabase/`)

Postgres on Supabase (hosted in Frankfurt, `eu-central-1`). `migrations/`
holds the schema in numbered files, `tests/` holds SQL assertion scripts,
`functions/` holds the one edge function (`delete-account`), and `templates/`
holds the auth e-mails. The root `AGENTS.md` applies too.

## A new migration

1. Take the next number: `ls supabase/migrations | tail -1`. Name it for
   what it does (`089_card_debits.sql`). Never edit a migration that is on
   `main`. Write a new one instead.
2. Every table gets:
   - `user_id` (the owner: a person, or a shared space; see
     [0008](../docs/decisions/0008-shared-space-is-an-owner.md)) and RLS
     policies that check it;
   - the demo guard:
     `create trigger refuse_demo_write before insert or update or delete on public.<table> for each row execute function public.refuse_demo_write();`
     Migration `081` added it to every table that existed then. A table
     created later must add its own (`087`'s `cards` didn't; see
     `docs/how-pluclair-works.md` « Known issues »).
3. A `security definer` function:
   - `revoke all … from public, anon, authenticated`, then grant only what is
     needed;
   - names the service role explicitly instead of trusting a missing
     `auth.uid()`. Migration `025` exists because `anon` has no `auth.uid()`
     either.
4. Write `tests/NNN_name.test.sql` for the RLS and functions. Each file raises
   on failure.
5. Apply it locally, then run `pnpm gen:types`.
6. Add its row to `docs/feature-map.md` « Migrations ». `pnpm check:docs`
   fails otherwise.
7. In the merge message, say « Migration NNN: to run on hosted ».

## Local database

- Start: `pnpm dlx supabase@2.119.0 start`. Keys:
  `pnpm dlx supabase@2.119.0 status -o json`.
- The local migration history is out of step (`supabase migration up --local`
  stops at 054 although the schema is current). Apply a new file directly:
  `docker exec -i supabase_db_finance-tracker psql -U postgres -d postgres < supabase/migrations/NNN_name.sql`.
- Run a test file the same way with `supabase/tests/NNN_name.test.sql`, or
  all of them:
  `for f in supabase/tests/*.test.sql; do docker exec -i supabase_db_finance-tracker psql -U postgres -q -v ON_ERROR_STOP=1 < "$f" || break; done`.
  CI doesn't run them, so run them by hand when you touch RLS or a function.
- If the gateway (`supabase_kong_finance-tracker`) won't start, often after a
  template file changed, `supabase stop` then `start` recreates it and keeps
  the data.

## Hosted database

- **Only the owner writes to it.** Hand them the SQL to run in the SQL editor,
  in order. Code must work until they do (root `AGENTS.md`).
- Auth e-mails are sent through Resend SMTP, set in the dashboard only.
  `config.toml` doesn't show it. The templates in `templates/` must be pasted
  into the dashboard after each change, subjects included.
- The Free plan has no backups. Ask the owner to export before a migration
  that rewrites data.

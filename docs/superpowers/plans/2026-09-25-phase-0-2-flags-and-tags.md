# Phase 0, Plan 0.2 — Feature flags and tag management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the app feature flags that both clients read the same way, and use the first one, `tags.manage`, to let people rename, merge and delete tags on the Plan page of both clients.

**Architecture:** A flag is evaluated in Postgres by one security-definer function, `evaluated_feature_flags()`, so the web server and the phone get the same answer from the same code. `packages/core/src/flags.ts` turns that answer into a typed set, where anything unknown is off. The web reads it once per request with React `cache`; the phone reads it once per signed-in session and keeps the last answer per account in AsyncStorage. Tag rename and delete use the existing RLS policies. Merge is a definer function, `merge_tags`, because since migration `036` the policies cannot reach the tag links of a transaction in the bin. The count shown before a delete comes from PostgREST's embedded count, which runs under RLS and so counts what the owner can see.

**Tech Stack:** TypeScript 5, Next.js 16.2.9 App Router (`apps/web`), Expo 57 / React Native with expo-router and NativeWind (`apps/mobile`), `packages/core` shipped as source to both, Supabase (Postgres 17 + RLS, supabase-js 2.108), zod 4, vitest 3, ESLint with the React Compiler rules, knip.

**Spec:** `docs/superpowers/specs/2026-09-25-phase-0-foundations-design.md`, tasks T5 and T6. Parent plan: `docs/plans/PLUCLAIR_UPGRADE_PLAN.md`, Phase 0.

**This is Plan 0.2 of five for Phase 0.** Plan 0.1 (trust fixes) has landed. Plan 0.3 (reference registry), 0.4 (AiProvider) and 0.5 (analytics, personas, phase close) follow, each written after the previous one lands.

## Corrections to the spec

Found while reading the code for this plan. Where the code contradicts the spec, the code wins; none of these change what the user sees.

1. **The flag tables are not readable by any session.** The spec (section 6) made flags readable by authenticated users and overrides readable by their owner. Every table in the schema today is readable by its owner alone, and `032_instrument_readings.sql:9-25` argues that the first table readable across accounts is the expensive one. Flags do not need to be it: clients only ever ask "which flags are on for me", and `evaluated_feature_flags()` answers that as a definer function. Both tables get RLS with no policy; the service role and the dashboard write them.
2. **`merge_tags` is `security definer`, not invoker.** `transaction_tags` is guarded only through `transactions` (`012_budgets_transfers_tags_goals.sql:128-155`), and `036` made the `transactions` select policy hide rows in the bin. An invoker can therefore neither see nor move the tag links of a binned transaction, while deleting the source tag still cascades to them, because the cascade is the one path RLS does not guard. A merge would silently strip the tag from every binned transaction, and restoring one would bring it back untagged. `transaction_tags` also has no update policy. The function does its own ownership checks with `acting_for`, as `036`'s functions do, and takes `target_user` explicitly, like every definer function in the schema.
3. **`merge_tags(target_user, from_tag, into_tag)`**, not `merge_tags(source, target)`: repository convention puts `target_user` first, and `target` would then mean two things.
4. **`reference.provenance` is seeded by Plan 0.3**, in the migration that creates the registry, not here. A flag key that no code reads would fail the reachability gate (`knip.jsonc` `rules.exports`).
5. **The flag gates the interface, not the writes.** The phone writes to Supabase directly under RLS, and RLS has always allowed an owner to rename and delete their own tags. A server-side flag check on the web actions alone would guard nothing, so there is none. Flags are for rollout, not for security.
6. **The delete confirmation counts only the transactions the owner can see.** The embedded count `tags.select("id, name, transaction_tags(count)")` runs under RLS, so links on binned transactions are not counted. Checked against the local stack on 2026-09-25: a tag on one live and one binned transaction reports `1`.

## Global Constraints

- Domain logic lives in `packages/core` as pure, tested functions; UI layers stay thin.
- Every user-facing string goes through `packages/core/src/i18n/messages/en.ts` and `fr.ts`. `fr.ts` is typed `Messages`, so `pnpm --filter @finance/core exec tsc --noEmit` is the parity check. French typography: a no-break space, written ` ` in `fr.ts`, before `? ! : ;`. French for *tag* is *étiquette* (feminine).
- On any screen whose behaviour or UI this plan changes, inherited hard-coded English moves into the catalogues too.
- `packages/core/src/i18n/unused-keys.test.ts` fails on a key that no source file reads as a literal, so every new key must be used, and is added in the task that uses it.
- A new module in `packages/core/src` needs an entry in `packages/core/package.json` `"exports"` (flat map, alphabetical) before either app can import it.
- `knip` (`pnpm check:reachability`) fails on a file nothing imports and on a `packages/core` export neither app uses. The flag modules are consumed only once the tag screens read them, so **reachability is part of the gates from Task 7 on**; before that it is expected to report the new, not-yet-consumed exports.
- `apps/web/DESIGN.md`: dark only; tokens only (no hex, no alpha literals, no arbitrary durations); gold accent only in its four homes; every rendered amount carries `.privacy-amount` / `PrivateAmount`. No amount is rendered in this plan.
- WCAG 2.2 AA: 44 px targets (56 px list rows), visible focus, labelled controls, reduced motion honoured.
- `CONTEXT.md` vocabulary: *tag* (never "label" or "group"), *transaction*.
- Migrations are additive and reversible, RLS on every table, and each is executed with `npx supabase db reset` on a local stack, plus its assertion script, before it is committed. If `docker` reports `permission denied` on `/var/run/docker.sock` in a shell older than your `docker` group membership, run the command as `sg docker -c "<command>"`.
- Before writing a Next.js route, page or server action, read the matching guide under `node_modules/next/dist/docs/01-app/` (this Next.js has breaking changes; data and `React.cache`: `01-getting-started/06-fetching-data.md`; server functions: `01-getting-started/07-mutating-data.md`).
- Gates before any task is called done: `pnpm --filter @finance/core exec tsc --noEmit`, `pnpm --filter web exec tsc --noEmit`, `pnpm --filter mobile exec tsc --noEmit`, `pnpm --filter @finance/core test`, `pnpm --filter web test`, `pnpm --filter web exec eslint --max-warnings 0 .`, `pnpm --filter mobile exec expo lint --max-warnings 0`, and (from Task 7 on) `pnpm check:reachability`.
- One concern per commit. Commit messages follow the repository's style: a plain sentence saying what changed for the reader, no `feat:` prefix, ending with the trailer `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Run `npx prettier --write <changed files>` (not `.sql`) before each commit.
- Commit on `main`, where Plan 0.1 landed. Do not push without the user's go-ahead.

## Review Focus

1. **A merge that touches a transaction in the bin.** The binned transaction must end up carrying the kept tag, so a restore brings it back tagged. Pinned in Task 5.
2. **A merge where one transaction carries both tags.** It keeps exactly one link, and the merge does not fail on the primary key. Pinned in Task 5.
3. **A flag the build does not know, or a flag the database does not return.** Both read as off on both clients, including when migration `039` has not run (web: `PGRST202` / `42883` from the RPC; phone: the RPC throws and the last answer, or none, stands). Pinned in Task 2 and Tasks 3–4.
4. **Two accounts on one phone.** The cached flags of one account must never show for the other. Pinned in Task 4 (storage key per user; a stale answer reads as "no flags").
5. **A rename onto a name that exists.** The client offers the merge instead. If the check is bypassed, for example because another device created the name a second ago, the server's `23505` becomes the catalogue's "already exists" message, not Postgres's text. Pinned in Tasks 6–8.

---

## File Structure

| File | Responsibility | Task |
|---|---|---|
| `supabase/migrations/039_feature_flags.sql` | **Create.** `feature_flags`, `user_feature_flags`, `evaluated_feature_flags()`, flag `tags.manage` | 1 |
| `supabase/tests/039_feature_flags.test.sql` | **Create.** What 039 must be true for | 1 |
| `packages/core/src/types/database.ts` | `evaluated_feature_flags` and `merge_tags` in `Functions` | 1, 5 |
| `packages/core/src/flags.ts` (+ test) | **Create.** Typed flag keys, the answer as a set, the phone's cache format | 2 |
| `packages/core/package.json` | `"./flags"`, `"./tags"` exports | 2, 6 |
| `apps/web/lib/flags.ts` | **Create.** `getFlags()`, once per request | 3 |
| `apps/mobile/src/lib/flags.ts` | **Create.** Read, fetch and cache the flags per account | 4 |
| `apps/mobile/src/providers/FlagsProvider.tsx` | **Create.** Flags for the signed-in account; `useFlag` | 4 |
| `apps/mobile/src/app/_layout.tsx` | Mounts `FlagsProvider` | 4 |
| `supabase/migrations/040_merge_tags.sql` | **Create.** `merge_tags(target_user, from_tag, into_tag)` | 5 |
| `supabase/tests/040_merge_tags.test.sql` | **Create.** Merge, bin, overlap, refusals, delete cascade | 5 |
| `packages/core/src/tags.ts` (+ test) | **Create.** `TagUsage`, `tagUsageFromRows`, `findRenameConflict` | 6 |
| `packages/core/src/i18n/messages/en.ts`, `fr.ts` | Tag management, errors, the confirm sheet's own labels | 7, 8 |
| `apps/web/lib/queries/phase4.ts` | `getTagUsage` | 7 |
| `apps/web/lib/actions/phase4.ts` | `renameTag`, `deleteTag`, `mergeTags`; duplicate names in the catalogue's words | 7 |
| `apps/web/components/finance/TagsCard.tsx` | **Create.** The Plan page's Tags card, managed when the flag is on | 7 |
| `apps/web/app/(app)/budgets/BudgetsView.tsx` | Renders `TagsCard` | 7 |
| `apps/web/app/(app)/budgets/page.tsx` | Reads the flag and the usage counts | 7 |
| `apps/mobile/src/lib/queries.ts` | `getTagUsage` | 8 |
| `apps/mobile/src/lib/mutations.ts` | `renameTag`, `deleteTag`, `mergeTags`; duplicate names in the catalogue's words | 8 |
| `apps/mobile/src/components/TagEditSheet.tsx` | **Create.** Rename, merge, delete one tag | 8 |
| `apps/mobile/src/components/ui/ConfirmSheet.tsx` | Default labels from the catalogue | 8 |
| `apps/mobile/src/app/(tabs)/planning.tsx` | Tags open the sheet when the flag is on | 8 |
| `docs/how-pluclair-works.md` | Feature flags section, known issues | 9 |

---

### Task 1: Migration 039 — feature flags, evaluated in the database

**Files:**
- Create: `supabase/migrations/039_feature_flags.sql`
- Create: `supabase/tests/039_feature_flags.test.sql`
- Modify: `packages/core/src/types/database.ts` (`Functions`, before `refund_category_selection`)

**Interfaces:**
- Consumes: `auth.users`.
- Produces: tables `feature_flags(key, description, enabled_by_default, enabled_from, created_at)` and `user_feature_flags(user_id, flag_key, enabled, created_at)`, with RLS and no policies; function `evaluated_feature_flags() returns table (key text, enabled boolean)`, executable by `authenticated` and `service_role`; seeded flag `tags.manage`, off. Type `Database["public"]["Functions"]["evaluated_feature_flags"]`.

- [ ] **Step 1: Write the failing assertion script**

Create `supabase/tests/039_feature_flags.test.sql`:

```sql
-- What migration 039 has to be true for.
--
--   npx supabase db reset
--   docker exec -i supabase_db_finance-tracker psql -U postgres \
--     -v ON_ERROR_STOP=1 < supabase/tests/039_feature_flags.test.sql
--
-- Every check raises rather than returns; silence to the final echo is the
-- pass.

\set ON_ERROR_STOP on

begin;

-- ---------------------------------------------------------------- fixtures

-- An account from before any cut-off, and one from after.
insert into auth.users (id, email, created_at)
values
  (
    '11111111-1111-1111-1111-111111111111',
    'early@example.test',
    timestamptz '2026-01-15 09:00+00'
  ),
  (
    '22222222-2222-2222-2222-222222222222',
    'late@example.test',
    timestamptz '2026-07-15 09:00+00'
  )
on conflict (id) do nothing;

insert into feature_flags (key, description, enabled_by_default, enabled_from)
values
  ('test.off', 'Off for everyone.', false, null),
  ('test.on', 'On for everyone.', true, null),
  (
    'test.new_accounts',
    'On for accounts created from June.',
    false,
    timestamptz '2026-06-01 00:00+00'
  );

insert into user_feature_flags (user_id, flag_key, enabled)
values
  ('11111111-1111-1111-1111-111111111111', 'test.off', true),
  ('22222222-2222-2222-2222-222222222222', 'test.on', false);

create or replace function test_become(who uuid) returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', who, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end;
$$;

create or replace function test_assert(ok boolean, what text) returns void
language plpgsql as $$
begin
  if ok is not true then
    raise exception 'FAILED: %', what;
  end if;
  raise notice '  ok  %', what;
end;
$$;

-- One flag's answer for whoever the session is. Null: no such row.
create or replace function test_flag(flag text) returns boolean
language sql as $$
  select enabled from evaluated_feature_flags() where key = flag;
$$;

-- --------------------------------------------------- the early account

select test_become('11111111-1111-1111-1111-111111111111');

select test_assert(
  test_flag('tags.manage') is false,
  'tags.manage is seeded, and off');

select test_assert(
  test_flag('test.on') is true,
  'a flag on by default is on');

select test_assert(
  test_flag('test.off') is true,
  'an override turns a flag on for one account');

select test_assert(
  test_flag('test.new_accounts') is false,
  'an account older than the cut-off stays off');

select test_assert(
  test_flag('no.such_flag') is null,
  'a flag the database does not know has no row');

-- ---------------------------------------------------- the late account

select test_become('22222222-2222-2222-2222-222222222222');

select test_assert(
  test_flag('test.off') is false,
  'another account''s override is not mine');

select test_assert(
  test_flag('test.on') is false,
  'an override turns a default-on flag off');

select test_assert(
  test_flag('test.new_accounts') is true,
  'an account from after the cut-off is on');

-- ------------------------------------------------ nobody reads the tables

select test_assert(
  (select count(*) from feature_flags) = 0,
  'no session reads the flag table itself');

select test_assert(
  (select count(*) from user_feature_flags) = 0,
  'nor anybody''s overrides, its own included');

do $$
begin
  insert into user_feature_flags (user_id, flag_key, enabled)
  values ('22222222-2222-2222-2222-222222222222', 'test.off', true);
  raise exception 'FAILED: a session switched a flag for itself';
exception
  when insufficient_privilege then
    raise notice '  ok  a session cannot switch a flag for itself';
end;
$$;

-- ---------------------------------------------------------- no session

reset role;
select set_config('request.jwt.claims',
  json_build_object('role', 'anon')::text, true);
select set_config('role', 'anon', true);

do $$
begin
  perform evaluated_feature_flags();
  raise exception 'FAILED: anon was allowed to ask';
exception
  when insufficient_privilege then
    raise notice '  ok  anon cannot ask at all';
end;
$$;

rollback;

\echo 'migration 039: all checks passed'
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx supabase db reset && docker exec -i supabase_db_finance-tracker psql -U postgres -v ON_ERROR_STOP=1 < supabase/tests/039_feature_flags.test.sql`
Expected: `ERROR:  relation "feature_flags" does not exist`, exit non-zero.

- [ ] **Step 3: Write the migration**

Create `supabase/migrations/039_feature_flags.sql`:

```sql
-- 039: feature flags, evaluated where both clients can ask the same question.
--
-- Every user-facing change in the upgrade plan ships behind a flag, off for
-- existing accounts unless its phase says otherwise. A flag has a global
-- default and an optional moment from which newly created accounts get it;
-- a per-account override wins over both.
--
-- ## Why no session can read the tables
--
-- Every table in this schema is readable by its owner alone, and 032 set out
-- why the first table readable across accounts would be the expensive one.
-- Flags do not need to be it: the only question a client ever asks is "which
-- flags are on for me", and `evaluated_feature_flags()` answers it as a
-- definer function. So both tables have RLS on and no policy at all. The
-- service role and the dashboard write them; no session reads a row.
--
-- ## Why a definer function
--
-- The cut-off compares the account's `auth.users.created_at`, which no
-- session may read. The function reads it for `auth.uid()` alone, and a
-- caller with no session gets no rows (and anon cannot call it).
--
-- Switched with SQL or the Supabase dashboard; there is no admin screen. The
-- statements are in "Feature flags" in docs/how-pluclair-works.md.
--
-- Reversible, and nothing else refers to these objects:
--   drop function evaluated_feature_flags();
--   drop table user_feature_flags;
--   drop table feature_flags;
--
-- Every assertion this is meant to satisfy is in
-- `supabase/tests/039_feature_flags.test.sql`.

/* -------------------------------------------------------------- the flags */

create table if not exists feature_flags (
  key text primary key
    check (key ~ '^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$'),
  description text not null,
  enabled_by_default boolean not null default false,
  -- Null: no cut-off. Otherwise on for every account created at or after it.
  enabled_from timestamptz,
  created_at timestamptz not null default now()
);

comment on table feature_flags is
  'One row per flag. Read only through evaluated_feature_flags().';

/* ---------------------------------------------------------- the overrides */

create table if not exists user_feature_flags (
  user_id uuid not null references auth.users (id) on delete cascade,
  flag_key text not null
    references feature_flags (key) on delete cascade on update cascade,
  enabled boolean not null,
  created_at timestamptz not null default now(),
  primary key (user_id, flag_key)
);

comment on table user_feature_flags is
  'A per-account answer that wins over the flag''s default and cut-off.';

alter table feature_flags enable row level security;
alter table user_feature_flags enable row level security;

-- No policies, deliberately: see the header.

/* ----------------------------------------------------------- the question */

create or replace function evaluated_feature_flags()
returns table (key text, enabled boolean)
language sql
stable
security definer
set search_path = public
as $$
  select
    f.key,
    coalesce(
      o.enabled,
      -- `coalesce` because a null cut-off, or a null created_at, compares to
      -- null, and a flag is on or off: never unknown.
      f.enabled_by_default or coalesce(u.created_at >= f.enabled_from, false)
    )
  from feature_flags f
  join auth.users u on u.id = auth.uid()
  left join user_feature_flags o
    on o.flag_key = f.key and o.user_id = u.id
  order by f.key;
$$;

comment on function evaluated_feature_flags() is
  'Every flag with its answer for auth.uid(). No session, no rows.';

/* ------------------------------------------------------------- the grants */

-- Postgres grants EXECUTE to PUBLIC by default, so the grant alone would
-- restrict nothing (see 025).
revoke execute on function evaluated_feature_flags() from public, anon;
grant execute on function evaluated_feature_flags() to authenticated, service_role;

/* ----------------------------------------------------------- first flags */

insert into feature_flags (key, description)
values (
  'tags.manage',
  'Rename, merge and delete tags on the Plan page (Phase 0, T6).'
)
on conflict (key) do nothing;
```

- [ ] **Step 4: Run the whole chain and every assertion script**

Run:

```bash
npx supabase db reset
for f in supabase/tests/*.test.sql; do docker exec -i supabase_db_finance-tracker psql -U postgres -q -v ON_ERROR_STOP=1 < "$f" || { echo "FAILED: $f"; break; }; done
```

Expected: the reset ends `Finished supabase db reset`; each script ends with its passing line (`036 verified.`, `migration 038: all checks passed`, `migration 039: all checks passed`), and no `FAILED`.

- [ ] **Step 5: Type the function**

In `packages/core/src/types/database.ts`, inside `Functions`, immediately before the doc comment `/** Hand back an attempt that never reached the provider. */` that opens `refund_category_selection`, add:

```ts
      /**
       * Every feature flag with its answer for the caller (039). A flag the
       * database does not hold has no row; a caller with no session gets none.
       */
      evaluated_feature_flags: {
        Args: Record<PropertyKey, never>;
        Returns: { key: string; enabled: boolean }[];
      };
```

- [ ] **Step 6: Gates**

Run: `pnpm --filter @finance/core exec tsc --noEmit && pnpm --filter web exec tsc --noEmit && pnpm --filter mobile exec tsc --noEmit`
Expected: all pass.

- [ ] **Step 7: Commit**

```bash
npx prettier --write packages/core/src/types/database.ts
git add supabase/migrations/039_feature_flags.sql supabase/tests/039_feature_flags.test.sql packages/core/src/types/database.ts
git commit -m "$(cat <<'EOF'
Add feature flags, evaluated in the database

A flag has a default, an optional moment from which new accounts get it,
and per-account overrides that win over both. evaluated_feature_flags()
answers for the caller, so the web and the phone get the same answer from
the same code. No session can read the tables themselves: the function is
the only way in, and the service role or the dashboard switches flags.

The first flag, tags.manage, is off.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Core — flags as a typed set

**Files:**
- Create: `packages/core/src/flags.ts`
- Create: `packages/core/src/flags.test.ts`
- Modify: `packages/core/package.json` (`"exports"`)

**Interfaces:**
- Consumes: the rows of `evaluated_feature_flags()`, typed `unknown` so a malformed answer cannot throw.
- Produces: `type FlagKey = "tags.manage"`; `type FlagSet = ReadonlySet<FlagKey>`; `NO_FLAGS: FlagSet`; `flagsFromRows(rows: unknown): FlagSet`; `isFlagOn(flags: FlagSet, key: FlagKey): boolean`; `serializeFlags(flags: FlagSet): string`; `parseStoredFlags(raw: string | null): FlagSet | null`.

- [ ] **Step 1: Write the failing test**

Create `packages/core/src/flags.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  flagsFromRows,
  isFlagOn,
  NO_FLAGS,
  parseStoredFlags,
  serializeFlags,
} from "./flags";

describe("flagsFromRows", () => {
  it("turns a flag on when the database says it is", () => {
    const flags = flagsFromRows([{ key: "tags.manage", enabled: true }]);
    expect(isFlagOn(flags, "tags.manage")).toBe(true);
  });

  it("keeps a flag off when the database says it is off", () => {
    const flags = flagsFromRows([{ key: "tags.manage", enabled: false }]);
    expect(isFlagOn(flags, "tags.manage")).toBe(false);
  });

  it("ignores a flag this build does not know", () => {
    const flags = flagsFromRows([
      { key: "no.such_flag", enabled: true },
      { key: "tags.manage", enabled: true },
    ]);
    expect([...flags]).toEqual(["tags.manage"]);
  });

  it("reads anything that is not a list of rows as no flags", () => {
    expect(flagsFromRows(null).size).toBe(0);
    expect(flagsFromRows({ key: "tags.manage", enabled: true }).size).toBe(0);
    expect(
      flagsFromRows([null, "tags.manage", { key: "tags.manage" }]).size,
    ).toBe(0);
  });

  it("only counts `enabled: true`, not something truthy", () => {
    expect(flagsFromRows([{ key: "tags.manage", enabled: "true" }]).size).toBe(
      0,
    );
  });
});

describe("isFlagOn", () => {
  it("is off for every key when nothing is known", () => {
    expect(isFlagOn(NO_FLAGS, "tags.manage")).toBe(false);
  });
});

describe("the phone's cache format", () => {
  it("round-trips the flags that are on", () => {
    const flags = flagsFromRows([{ key: "tags.manage", enabled: true }]);
    const back = parseStoredFlags(serializeFlags(flags));
    expect(back && isFlagOn(back, "tags.manage")).toBe(true);
  });

  it("says nothing is cached when nothing is", () => {
    expect(parseStoredFlags(null)).toBeNull();
  });

  it("treats a damaged entry as nothing cached, not as no flags", () => {
    expect(parseStoredFlags("{not json")).toBeNull();
    expect(parseStoredFlags('{"tags.manage":true}')).toBeNull();
  });

  it("drops a key an older or newer build wrote", () => {
    const back = parseStoredFlags('["no.such_flag","tags.manage"]');
    expect(back ? [...back] : null).toEqual(["tags.manage"]);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `pnpm --filter @finance/core exec vitest run src/flags.test.ts`
Expected: FAIL, `Failed to resolve import "./flags"`.

- [ ] **Step 3: Write the module**

Create `packages/core/src/flags.ts`:

```ts
/**
 * Feature flags, as the apps see them.
 *
 * The database decides (`evaluated_feature_flags()`, migration 039): a flag's
 * default, its cut-off for new accounts, and per-account overrides. This
 * module only turns that answer into a set the apps can ask, and its rule is
 * that anything short of a clear "on" is off — a key this build does not
 * know, a row missing, a malformed answer. A flag's off side is the app as it
 * was, so off is the one wrong answer that costs nothing.
 *
 * A flag is added here in the same change that reads it: the database may
 * hold flags an older build has never heard of, and those are ignored.
 */

const FLAG_KEYS = [
  /** Rename, merge and delete tags on the Plan page (Phase 0, T6). */
  "tags.manage",
] as const;

export type FlagKey = (typeof FLAG_KEYS)[number];

/** The flags that are on. Anything absent is off. */
export type FlagSet = ReadonlySet<FlagKey>;

export const NO_FLAGS: FlagSet = new Set<FlagKey>();

function isFlagKey(value: unknown): value is FlagKey {
  return (
    typeof value === "string" &&
    (FLAG_KEYS as readonly string[]).includes(value)
  );
}

/** The rows `evaluated_feature_flags()` returned, as the flags that are on. */
export function flagsFromRows(rows: unknown): FlagSet {
  if (!Array.isArray(rows)) {
    return NO_FLAGS;
  }
  const on = new Set<FlagKey>();
  for (const row of rows) {
    if (typeof row !== "object" || row === null) {
      continue;
    }
    const { key, enabled } = row as { key?: unknown; enabled?: unknown };
    if (enabled === true && isFlagKey(key)) {
      on.add(key);
    }
  }
  return on;
}

export function isFlagOn(flags: FlagSet, key: FlagKey): boolean {
  return flags.has(key);
}

/** The phone keeps the last answer between launches: the keys that are on. */
export function serializeFlags(flags: FlagSet): string {
  return JSON.stringify([...flags].sort());
}

/**
 * The cached answer, or null when there is none worth trusting.
 *
 * Null rather than "no flags" for a damaged entry, so the caller can tell
 * "nothing cached" from "cached, and everything was off".
 */
export function parseStoredFlags(raw: string | null): FlagSet | null {
  if (raw === null) {
    return null;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!Array.isArray(parsed)) {
    return null;
  }
  return new Set(parsed.filter(isFlagKey));
}
```

- [ ] **Step 4: Export it**

In `packages/core/package.json` `"exports"`, add in alphabetical position:

```json
    "./flags": "./src/flags.ts",
```

- [ ] **Step 5: Run the test**

Run: `pnpm --filter @finance/core exec vitest run src/flags.test.ts`
Expected: PASS, 10 tests.

- [ ] **Step 6: Gates**

Run: `pnpm --filter @finance/core exec tsc --noEmit && pnpm --filter @finance/core test`
Expected: all pass. (`pnpm check:reachability` will report the new exports until Tasks 3 and 4 use them, and `useFlag` until Task 8.)

- [ ] **Step 7: Commit**

```bash
npx prettier --write packages/core/src/flags.ts packages/core/src/flags.test.ts packages/core/package.json
git add packages/core/src/flags.ts packages/core/src/flags.test.ts packages/core/package.json
git commit -m "$(cat <<'EOF'
Read the database's feature flags as a typed set

A flag is on only when the database says so and this build knows its
key; a malformed answer, a missing row or an unknown key is off. The
phone's cache format lives here too, so a damaged entry reads as nothing
cached rather than as every flag off.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Web — flags once per request

**Files:**
- Create: `apps/web/lib/flags.ts`

**Interfaces:**
- Consumes: `evaluated_feature_flags` (Task 1), `flagsFromRows`, `NO_FLAGS`, `FlagSet` (Task 2), `createClient` (`apps/web/lib/supabase/server.ts`).
- Produces: `getFlags(): Promise<FlagSet>`, memoised per request. Read by the Plan page in Task 7.

- [ ] **Step 1: Read the guide**

Read `node_modules/next/dist/docs/01-app/01-getting-started/06-fetching-data.md`, section "Sharing data with context and `React.cache`" (from line 541): `React.cache` is scoped to one request. `cacheComponents` is not enabled in `apps/web/next.config.ts`, so nothing else changes.

- [ ] **Step 2: Write the module**

Create `apps/web/lib/flags.ts`:

```ts
import "server-only";

import { cache } from "react";
import { flagsFromRows, NO_FLAGS, type FlagSet } from "@finance/core/flags";
import { createClient } from "@/lib/supabase/server";

/**
 * The feature flags on for this request's account, asked of the database once.
 *
 * `evaluated_feature_flags()` (migration 039) does the evaluating, so the
 * phone gets the same answer from the same function. Wrapped in `cache()` for
 * the same reason `getAuthUser` is: a page and every component under it ask
 * once per request.
 *
 * Anything short of an answer reads as every flag off: signed out, the
 * migration not yet run, a fault. A flag's off side is the app as it was.
 */
export const getFlags = cache(async (): Promise<FlagSet> => {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("evaluated_feature_flags");
  if (error) {
    // PGRST202 / 42883: no such function, which is migration 039 not run.
    // Expected until it is, so not worth a line in the logs.
    if (error.code !== "PGRST202" && error.code !== "42883") {
      console.error("Failed to read feature flags", error);
    }
    return NO_FLAGS;
  }
  return flagsFromRows(data);
});
```

- [ ] **Step 3: Gates**

Run: `pnpm --filter web exec tsc --noEmit && pnpm --filter web exec eslint --max-warnings 0 .`
Expected: both pass. (knip reports `apps/web/lib/flags.ts` as unused until Task 7.)

- [ ] **Step 4: Commit**

```bash
npx prettier --write apps/web/lib/flags.ts
git add apps/web/lib/flags.ts
git commit -m "$(cat <<'EOF'
Let web pages ask for feature flags once per request

getFlags() calls evaluated_feature_flags() and memoises the answer for
the request. Without migration 039, signed out, or on any fault, every
flag reads as off.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Phone — flags once per session, the last answer kept per account

**Files:**
- Create: `apps/mobile/src/lib/flags.ts`
- Create: `apps/mobile/src/providers/FlagsProvider.tsx`
- Modify: `apps/mobile/src/app/_layout.tsx:23-26,178-180`

**Interfaces:**
- Consumes: `evaluated_feature_flags` (Task 1), `flagsFromRows`, `parseStoredFlags`, `serializeFlags`, `isFlagOn`, `NO_FLAGS`, `FlagKey`, `FlagSet` (Task 2), `useAuth` (`providers/AuthProvider.tsx`), `supabase` (`lib/supabase.ts`).
- Produces: `FlagsProvider`; `useFlag(key: FlagKey): boolean`. Read by the Plan screen in Task 8.

- [ ] **Step 1: The storage and the fetch**

Create `apps/mobile/src/lib/flags.ts`:

```ts
import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  flagsFromRows,
  parseStoredFlags,
  serializeFlags,
  type FlagSet,
} from "@finance/core/flags";

import { supabase } from "@/lib/supabase";

/**
 * Keyed per account, as onboarding is: two people on one phone must never
 * see each other's flags, even for the moment before the fetch answers.
 */
function storageKey(userId: string): string {
  return `flags.${userId}`;
}

/** The last answer this device had for the account, or null. */
export async function loadStoredFlags(userId: string): Promise<FlagSet | null> {
  try {
    return parseStoredFlags(await AsyncStorage.getItem(storageKey(userId)));
  } catch {
    return null;
  }
}

/**
 * Asks the database, and keeps the answer for the next launch.
 *
 * Throws when there is no answer (offline, migration 039 not run), so the
 * caller keeps whatever it already had.
 */
export async function fetchFlags(userId: string): Promise<FlagSet> {
  const { data, error } = await supabase.rpc("evaluated_feature_flags");
  if (error) {
    throw error;
  }
  const flags = flagsFromRows(data);
  try {
    await AsyncStorage.setItem(storageKey(userId), serializeFlags(flags));
  } catch {
    // Ignored: the answer still holds for this session.
  }
  return flags;
}
```

- [ ] **Step 2: The provider**

Create `apps/mobile/src/providers/FlagsProvider.tsx`:

```tsx
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

import {
  isFlagOn,
  NO_FLAGS,
  type FlagKey,
  type FlagSet,
} from "@finance/core/flags";

import { fetchFlags, loadStoredFlags } from "@/lib/flags";
import { useAuth } from "@/providers/AuthProvider";

const FlagsContext = createContext<FlagSet | null>(null);

/**
 * The feature flags for the signed-in account.
 *
 * Read once per session — at launch with a stored session, or at sign-in —
 * rather than on every screen: a flag is a rollout switch, and one that
 * changes under somebody mid-session is a screen rearranging itself for no
 * reason they can see. The cached answer shows first, so a flag that was on
 * yesterday does not blink off while the network answers; the fresh answer
 * replaces it. With neither, every flag is off.
 */
export function FlagsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const userId = user?.id;
  const [state, setState] = useState<{
    userId: string;
    flags: FlagSet;
  } | null>(null);

  useEffect(() => {
    if (!userId) {
      return;
    }
    let active = true;
    void (async () => {
      const stored = await loadStoredFlags(userId);
      if (active && stored) {
        setState({ userId, flags: stored });
      }
      try {
        const fresh = await fetchFlags(userId);
        if (active) {
          setState({ userId, flags: fresh });
        }
      } catch {
        // Offline, or migration 039 not run. The last answer, or none,
        // stands; the next session asks again.
      }
    })();
    return () => {
      active = false;
    };
  }, [userId]);

  // A previous account's answer reads as nothing known, not as this one's.
  const flags = state && state.userId === userId ? state.flags : NO_FLAGS;

  return (
    <FlagsContext.Provider value={flags}>{children}</FlagsContext.Provider>
  );
}

export function useFlag(key: FlagKey): boolean {
  const flags = useContext(FlagsContext);
  if (!flags) {
    throw new Error("useFlag must be used within a FlagsProvider");
  }
  return isFlagOn(flags, key);
}
```

- [ ] **Step 3: Mount it**

In `apps/mobile/src/app/_layout.tsx`, add the import beside the other providers (after `import { CurrencyProvider } from "@/providers/CurrencyProvider";`):

```tsx
import { FlagsProvider } from "@/providers/FlagsProvider";
```

and replace:

```tsx
                        <OnboardingProvider>
                          <RootNavigator fontsReady={fontsReady} />
                        </OnboardingProvider>
```

with:

```tsx
                        <OnboardingProvider>
                          {/* Below AuthProvider, whose user it asks for; around
                              the navigator, so every screen reads one answer. */}
                          <FlagsProvider>
                            <RootNavigator fontsReady={fontsReady} />
                          </FlagsProvider>
                        </OnboardingProvider>
```

- [ ] **Step 4: Gates**

Run: `pnpm --filter mobile exec tsc --noEmit && pnpm --filter mobile exec expo lint --max-warnings 0`
Expected: both pass. (knip reports `useFlag` as unused until Task 8.)

- [ ] **Step 5: Commit**

```bash
npx prettier --write apps/mobile/src/lib/flags.ts apps/mobile/src/providers/FlagsProvider.tsx apps/mobile/src/app/_layout.tsx
git add apps/mobile/src/lib/flags.ts apps/mobile/src/providers/FlagsProvider.tsx apps/mobile/src/app/_layout.tsx
git commit -m "$(cat <<'EOF'
Let the phone read feature flags once per session

FlagsProvider asks evaluated_feature_flags() at launch or sign-in and keeps
the answer per account, so the next launch starts from it and a second
account on the same phone never sees the first one's. Without an answer
every flag is off.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Migration 040 — merge one tag into another

**Files:**
- Create: `supabase/migrations/040_merge_tags.sql`
- Create: `supabase/tests/040_merge_tags.test.sql`
- Modify: `packages/core/src/types/database.ts` (`Functions`, after `evaluated_feature_flags`)

**Interfaces:**
- Consumes: `tags`, `transaction_tags` (012), `acting_for` (025), `transactions.deleted_at` (036).
- Produces: `merge_tags(target_user uuid, from_tag uuid, into_tag uuid) returns integer` (how many transactions gained `into_tag`), executable by `authenticated` and `service_role`. It raises `insufficient_privilege` when the caller may not act for `target_user` or either tag is not theirs, and `invalid_parameter_value` for a tag merged into itself. Type `Database["public"]["Functions"]["merge_tags"]`.

- [ ] **Step 1: Write the failing assertion script**

Create `supabase/tests/040_merge_tags.test.sql`:

```sql
-- What migration 040 has to be true for.
--
--   npx supabase db reset
--   docker exec -i supabase_db_finance-tracker psql -U postgres \
--     -v ON_ERROR_STOP=1 < supabase/tests/040_merge_tags.test.sql
--
-- Every check raises rather than returns; silence to the final echo is the
-- pass.

\set ON_ERROR_STOP on

begin;

-- ---------------------------------------------------------------- fixtures

insert into auth.users (id, email)
values
  ('11111111-1111-1111-1111-111111111111', 'mine@example.test'),
  ('22222222-2222-2222-2222-222222222222', 'theirs@example.test')
on conflict (id) do nothing;

insert into categories (id, user_id, name, type)
values (
  'aaaaaaaa-0000-0000-0000-000000000001',
  '11111111-1111-1111-1111-111111111111',
  'Groceries',
  'expense'
);

insert into transactions (id, user_id, category_id, occurred_on, amount)
select
  ('bbbbbbbb-0000-0000-0000-00000000000' || n)::uuid,
  '11111111-1111-1111-1111-111111111111',
  'aaaaaaaa-0000-0000-0000-000000000001',
  date '2026-09-01' + n,
  10 * n
from generate_series(1, 4) as n;

-- Holiday and Trip are to be merged; Flatmate is to be deleted; Theirs
-- belongs to somebody else.
insert into tags (id, user_id, name)
values
  ('cccccccc-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Holiday'),
  ('cccccccc-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'Trip'),
  ('cccccccc-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', 'Flatmate'),
  ('cccccccc-0000-0000-0000-000000000009', '22222222-2222-2222-2222-222222222222', 'Theirs');

-- Transaction 2 carries both Holiday and Trip. Transaction 3 is about to go
-- in the bin still carrying Holiday.
insert into transaction_tags (transaction_id, tag_id)
values
  ('bbbbbbbb-0000-0000-0000-000000000001', 'cccccccc-0000-0000-0000-000000000001'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'cccccccc-0000-0000-0000-000000000001'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'cccccccc-0000-0000-0000-000000000002'),
  ('bbbbbbbb-0000-0000-0000-000000000003', 'cccccccc-0000-0000-0000-000000000001'),
  ('bbbbbbbb-0000-0000-0000-000000000004', 'cccccccc-0000-0000-0000-000000000003');

update transactions
   set deleted_at = now()
 where id = 'bbbbbbbb-0000-0000-0000-000000000003';

create or replace function test_become(who uuid) returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', who, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end;
$$;

create or replace function test_assert(ok boolean, what text) returns void
language plpgsql as $$
begin
  if ok is not true then
    raise exception 'FAILED: %', what;
  end if;
  raise notice '  ok  %', what;
end;
$$;

-- ------------------------------------------------------------- the merge

select test_become('11111111-1111-1111-1111-111111111111');

-- Transaction 1 gains Trip, transaction 3 (in the bin) gains Trip, and
-- transaction 2 already had it: two moved.
select test_assert(
  merge_tags(
    '11111111-1111-1111-1111-111111111111',
    'cccccccc-0000-0000-0000-000000000001',
    'cccccccc-0000-0000-0000-000000000002') = 2,
  'a merge moves every transaction the tag was on, the one in the bin included');

select test_assert(
  (select count(*) from tags
    where id = 'cccccccc-0000-0000-0000-000000000001') = 0,
  'the merged tag is gone');

select test_assert(
  (select count(*) from transaction_tags
    where transaction_id = 'bbbbbbbb-0000-0000-0000-000000000002') = 1,
  'a transaction that carried both keeps exactly one link');

select test_assert(
  (select count(*) from transaction_tags
    where tag_id = 'cccccccc-0000-0000-0000-000000000002') = 2,
  'what the owner can see carries the kept tag');

reset role;

select test_assert(
  (select count(*) from transaction_tags
    where transaction_id = 'bbbbbbbb-0000-0000-0000-000000000003'
      and tag_id = 'cccccccc-0000-0000-0000-000000000002') = 1,
  'the transaction in the bin carries the kept tag, ready for a restore');

select test_assert(
  (select count(*) from transaction_tags
    where tag_id = 'cccccccc-0000-0000-0000-000000000001') = 0,
  'no link to the merged tag survives');

-- ---------------------------------------------------------- the refusals

select test_become('11111111-1111-1111-1111-111111111111');

do $$
begin
  perform merge_tags(
    '11111111-1111-1111-1111-111111111111',
    'cccccccc-0000-0000-0000-000000000002',
    'cccccccc-0000-0000-0000-000000000002');
  raise exception 'FAILED: a tag was merged into itself';
exception
  when invalid_parameter_value then
    raise notice '  ok  a tag cannot be merged into itself';
end;
$$;

do $$
begin
  perform merge_tags(
    '11111111-1111-1111-1111-111111111111',
    'cccccccc-0000-0000-0000-000000000002',
    'cccccccc-0000-0000-0000-000000000009');
  raise exception 'FAILED: my tag was merged into somebody else''s';
exception
  when insufficient_privilege then
    raise notice '  ok  a merge into somebody else''s tag is refused';
end;
$$;

select test_become('22222222-2222-2222-2222-222222222222');

do $$
begin
  perform merge_tags(
    '11111111-1111-1111-1111-111111111111',
    'cccccccc-0000-0000-0000-000000000003',
    'cccccccc-0000-0000-0000-000000000002');
  raise exception 'FAILED: another user merged my tags';
exception
  when insufficient_privilege then
    raise notice '  ok  a merge for somebody else is refused';
end;
$$;

reset role;

select test_assert(
  (select count(*) from tags
    where id in (
      'cccccccc-0000-0000-0000-000000000002',
      'cccccccc-0000-0000-0000-000000000003',
      'cccccccc-0000-0000-0000-000000000009')) = 3,
  'a refused merge leaves every tag where it was');

-- ------------------------------------------- delete and rename, unchanged

select test_become('11111111-1111-1111-1111-111111111111');

delete from tags where id = 'cccccccc-0000-0000-0000-000000000003';

reset role;

select test_assert(
  (select count(*) from transaction_tags
    where transaction_id = 'bbbbbbbb-0000-0000-0000-000000000004') = 0
  and (select count(*) from transactions
    where id = 'bbbbbbbb-0000-0000-0000-000000000004') = 1,
  'deleting a tag takes it off its transactions and leaves them');

select test_become('11111111-1111-1111-1111-111111111111');

insert into tags (id, user_id, name)
values (
  'cccccccc-0000-0000-0000-000000000004',
  '11111111-1111-1111-1111-111111111111',
  'Spare'
);

do $$
begin
  update tags set name = 'Trip'
   where id = 'cccccccc-0000-0000-0000-000000000004';
  raise exception 'FAILED: two tags share a name';
exception
  when unique_violation then
    raise notice '  ok  a rename onto a name in use is refused (the app offers the merge)';
end;
$$;

rollback;

\echo 'migration 040: all checks passed'
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx supabase db reset && docker exec -i supabase_db_finance-tracker psql -U postgres -v ON_ERROR_STOP=1 < supabase/tests/040_merge_tags.test.sql`
Expected: `ERROR:  function merge_tags(unknown, unknown, unknown) does not exist`, exit non-zero.

- [ ] **Step 3: Write the migration**

Create `supabase/migrations/040_merge_tags.sql`:

```sql
-- 040: merge one tag into another.
--
-- Rename and delete need nothing new: the tags policies (012) already let an
-- owner update and delete their own tags, and `transaction_tags` cascades
-- from `tags`. Merging does. Every transaction carrying the first tag has to
-- carry the second, the ones already carrying both must not collide, and the
-- first tag goes — in one transaction, or a failure halfway leaves
-- transactions tagged with neither.
--
-- ## Why security definer, where the design said invoker
--
-- The Phase 0 design named `security invoker`, relying on the existing
-- policies. Since 036 they cannot do it. `transaction_tags` is guarded only
-- through `transactions`, whose select policy now hides rows in the bin, so an
-- invoker can neither see nor move the tag links of a binned transaction —
-- while deleting the first tag would still cascade to them, the one path RLS
-- does not guard, and a restore would bring the transaction back untagged.
-- `transaction_tags` has no update policy either. So the function runs as its
-- owner and makes the checks itself, as 036's functions do: `acting_for` for
-- the caller, then both tags belonging to that user.
--
-- Reversible: `drop function merge_tags(uuid, uuid, uuid);`. Nothing else
-- refers to it, and a merge already made is ordinary data.
--
-- Every assertion this is meant to satisfy is in
-- `supabase/tests/040_merge_tags.test.sql`.

create or replace function merge_tags(
  target_user uuid,
  from_tag uuid,
  into_tag uuid
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  owned integer;
  moved integer;
begin
  if not acting_for(target_user) then
    raise exception 'merge_tags: not permitted for that user'
      using errcode = 'insufficient_privilege';
  end if;

  if from_tag is null or into_tag is null or from_tag = into_tag then
    raise exception 'merge_tags: a tag cannot be merged into itself'
      using errcode = 'invalid_parameter_value';
  end if;

  -- Both tags this user's, and held until the merge commits, so a rename or
  -- delete racing it waits rather than landing on a tag that is going.
  select count(*) into owned
    from (
      select 1
        from tags
       where id in (from_tag, into_tag) and user_id = target_user
         for update
    ) as locked;

  if owned <> 2 then
    raise exception 'merge_tags: both tags must belong to that user'
      using errcode = 'insufficient_privilege';
  end if;

  -- Every transaction the first tag is on, those in the bin included, gains
  -- the second. One already carrying both keeps its single link.
  insert into transaction_tags (transaction_id, tag_id)
  select transaction_id, into_tag
    from transaction_tags
   where tag_id = from_tag
  on conflict (transaction_id, tag_id) do nothing;

  get diagnostics moved = row_count;

  -- The cascade takes the first tag's remaining links with it.
  delete from tags where id = from_tag and user_id = target_user;

  return moved;
end;
$$;

comment on function merge_tags(uuid, uuid, uuid) is
  'Moves every transaction from from_tag to into_tag, then deletes from_tag. '
  'Returns how many transactions gained into_tag.';

/* ------------------------------------------------------------- the grants */

revoke execute on function merge_tags(uuid, uuid, uuid) from public, anon;
grant execute on function merge_tags(uuid, uuid, uuid) to authenticated, service_role;
```

- [ ] **Step 4: Run the whole chain and every assertion script**

Run:

```bash
npx supabase db reset
for f in supabase/tests/*.test.sql; do docker exec -i supabase_db_finance-tracker psql -U postgres -q -v ON_ERROR_STOP=1 < "$f" || { echo "FAILED: $f"; break; }; done
```

Expected: every script ends with its passing line, `migration 040: all checks passed` last, and no `FAILED`.

- [ ] **Step 5: Type the function**

In `packages/core/src/types/database.ts`, directly after the `evaluated_feature_flags` entry added in Task 1, add:

```ts
      /**
       * Move every transaction from one tag to another, those in the bin
       * included, then delete the first (040). Returns how many transactions
       * gained the second.
       */
      merge_tags: {
        Args: { target_user: string; from_tag: string; into_tag: string };
        Returns: number;
      };
```

- [ ] **Step 6: Gates**

Run: `pnpm --filter @finance/core exec tsc --noEmit && pnpm --filter web exec tsc --noEmit && pnpm --filter mobile exec tsc --noEmit`
Expected: all pass.

- [ ] **Step 7: Commit**

```bash
npx prettier --write packages/core/src/types/database.ts
git add supabase/migrations/040_merge_tags.sql supabase/tests/040_merge_tags.test.sql packages/core/src/types/database.ts
git commit -m "$(cat <<'EOF'
Add merge_tags, which moves a tag's transactions onto another

In one transaction: every transaction carrying the first tag gains the
second, one already carrying both keeps a single link, and the first tag
goes. It is a definer function because since 036 the policies cannot
reach the tag links of a transaction in the bin, and deleting the tag
would have stripped them silently; it checks the caller and both tags
itself, as 036's functions do.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: Core — tags with their usage, and the rename clash

**Files:**
- Create: `packages/core/src/tags.ts`
- Create: `packages/core/src/tags.test.ts`
- Modify: `packages/core/package.json` (`"exports"`)

**Interfaces:**
- Consumes: `Tag` (`types/database.ts`).
- Produces: `type TagUsage = { id: string; name: string; uses: number }`; `tagUsageFromRows(rows: readonly { id: string; name: string; transaction_tags: { count: number }[] }[]): TagUsage[]`; `findRenameConflict(tags: readonly TagUsage[], tagId: string, name: string): TagUsage | null`.

- [ ] **Step 1: Write the failing test**

Create `packages/core/src/tags.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { findRenameConflict, tagUsageFromRows, type TagUsage } from "./tags";

describe("tagUsageFromRows", () => {
  it("reads PostgREST's embedded count as the tag's uses", () => {
    expect(
      tagUsageFromRows([
        { id: "a", name: "Holiday", transaction_tags: [{ count: 3 }] },
      ]),
    ).toEqual([{ id: "a", name: "Holiday", uses: 3 }]);
  });

  it("reads a missing count as none", () => {
    expect(
      tagUsageFromRows([{ id: "a", name: "Holiday", transaction_tags: [] }]),
    ).toEqual([{ id: "a", name: "Holiday", uses: 0 }]);
  });
});

describe("findRenameConflict", () => {
  const tags: TagUsage[] = [
    { id: "a", name: "Holiday", uses: 3 },
    { id: "b", name: "Trip", uses: 1 },
  ];

  it("finds the other tag already holding the name", () => {
    expect(findRenameConflict(tags, "a", "Trip")?.id).toBe("b");
  });

  it("compares the name as it will be saved, trimmed", () => {
    expect(findRenameConflict(tags, "a", "  Trip ")?.id).toBe("b");
  });

  it("never clashes a tag with itself, so a change of case goes through", () => {
    expect(findRenameConflict(tags, "a", "Holiday")).toBeNull();
    expect(findRenameConflict(tags, "a", "holiday")).toBeNull();
  });

  it("is exact about case, as the database's unique constraint is", () => {
    expect(findRenameConflict(tags, "a", "trip")).toBeNull();
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `pnpm --filter @finance/core exec vitest run src/tags.test.ts`
Expected: FAIL, `Failed to resolve import "./tags"`.

- [ ] **Step 3: Write the module**

Create `packages/core/src/tags.ts`:

```ts
/**
 * Tags as the Plan page manages them: each with how many transactions carry it.
 *
 * The count is PostgREST's embedded count,
 * `tags.select("id, name, transaction_tags(count)")`, which runs under the
 * caller's RLS. A transaction in the bin (036) is not counted, and that is the
 * number the delete confirmation should state: the transactions the owner can
 * see.
 */
import type { Tag } from "./types/database";

export type TagUsage = Pick<Tag, "id" | "name"> & {
  /** Transactions carrying the tag, not counting any in the bin. */
  uses: number;
};

/** One row of `tags.select("id, name, transaction_tags(count)")`. */
type TagUsageRow = Pick<Tag, "id" | "name"> & {
  transaction_tags: { count: number }[];
};

export function tagUsageFromRows(rows: readonly TagUsageRow[]): TagUsage[] {
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    uses: row.transaction_tags[0]?.count ?? 0,
  }));
}

/**
 * The other tag a rename would collide with, if any, so the app can offer to
 * merge into it instead of failing.
 *
 * Exact after trimming, as `unique (user_id, name)` in 012 is: "Holiday" and
 * "holiday" are two tags to the database, so they are two here. The tag being
 * renamed never clashes with itself, which is what lets a rename change only
 * the case.
 */
export function findRenameConflict(
  tags: readonly TagUsage[],
  tagId: string,
  name: string,
): TagUsage | null {
  const wanted = name.trim();
  return tags.find((tag) => tag.id !== tagId && tag.name === wanted) ?? null;
}
```

- [ ] **Step 4: Export it**

In `packages/core/package.json` `"exports"`, add in alphabetical position:

```json
    "./tags": "./src/tags.ts",
```

- [ ] **Step 5: Run the test**

Run: `pnpm --filter @finance/core exec vitest run src/tags.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 6: Gates**

Run: `pnpm --filter @finance/core exec tsc --noEmit && pnpm --filter @finance/core test`
Expected: all pass.

- [ ] **Step 7: Commit**

```bash
npx prettier --write packages/core/src/tags.ts packages/core/src/tags.test.ts packages/core/package.json
git add packages/core/src/tags.ts packages/core/src/tags.test.ts packages/core/package.json
git commit -m "$(cat <<'EOF'
Describe tags with their usage, and find a rename's clash

tagUsageFromRows reads the embedded count PostgREST returns under RLS, so
a transaction in the bin is not counted. findRenameConflict names the
other tag a rename would collide with, exactly as the database's unique
constraint would, so the screens can offer a merge instead of an error.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: Web — rename, merge and delete on the Plan page's Tags card

**Files:**
- Modify: `packages/core/src/i18n/messages/en.ts`, `fr.ts` (`plan`, `errors`)
- Modify: `apps/web/lib/queries/phase4.ts:1-14,51-63`
- Modify: `apps/web/lib/actions/phase4.ts:179-219` (and append)
- Create: `apps/web/components/finance/TagsCard.tsx`
- Modify: `apps/web/app/(app)/budgets/BudgetsView.tsx:3-32,95-114,157-168,534-561`
- Modify: `apps/web/app/(app)/budgets/page.tsx:11-16,48-72,124-130`

**Interfaces:**
- Consumes: `getFlags` (Task 3), `isFlagOn` (Task 2), `merge_tags` (Task 5), `tagUsageFromRows`, `findRenameConflict`, `TagUsage` (Task 6), `ledger.entryCount` (exists).
- Produces: `getTagUsage(userId): Promise<TagUsage[]>`; server actions `renameTag(id, name)`, `deleteTag(id)`, `mergeTags(fromId, intoId)`, each returning `{ error?: string; success?: boolean }`; `TagsCard({ tags, manage })`; `BudgetsView` props `tags: TagUsage[]` and `manageTags: boolean`. Message keys listed in Step 1, reused by Task 8.

- [ ] **Step 1: Messages**

In `en.ts`, in the `plan` block after `tagAdded: "Tag added",`, add:

```ts
    /** Tag management (`tags.manage`). */
    editTagNamed: "Edit the tag {name}",
    tagName: "Name",
    renameTag: "Rename",
    tagRenamed: "Tag renamed",
    tagNameExists: "{name} already exists.",
    mergeIntoNamed: "Merge into {name}",
    mergeTagInto: "Merge into",
    chooseTag: "Choose a tag",
    mergeTag: "Merge",
    mergeTagHint:
      "Its transactions take the tag you choose, and {name} goes.",
    tagMerged: "Tags merged",
    deleteTag: "Delete tag",
    deleteTagUses: {
      one: "It comes off {count} transaction; the transaction stays.",
      other: "It comes off {count} transactions; the transactions stay.",
    },
    deleteTagUnused: "No transaction carries it.",
    confirmDeleteTag: "Yes, delete",
    tagDeleted: "Tag deleted",
```

In `en.ts`, in the `errors` block (alphabetical position among its keys), add:

```ts
    tagNameTaken: "A tag with that name already exists.",
    tagMergeFailed: "Those tags could not be merged.",
```

In `fr.ts`, at the same positions:

```ts
    editTagNamed: "Modifier l'étiquette {name}",
    tagName: "Nom",
    renameTag: "Renommer",
    tagRenamed: "Étiquette renommée",
    tagNameExists: "{name} existe déjà.",
    mergeIntoNamed: "Fusionner avec {name}",
    mergeTagInto: "Fusionner avec",
    chooseTag: "Choisir une étiquette",
    mergeTag: "Fusionner",
    mergeTagHint:
      "Ses transactions prennent l'étiquette choisie, et {name} disparaît.",
    tagMerged: "Étiquettes fusionnées",
    deleteTag: "Supprimer l'étiquette",
    deleteTagUses: {
      one: "Elle sera retirée de {count} transaction ; la transaction reste.",
      other:
        "Elle sera retirée de {count} transactions ; les transactions restent.",
    },
    deleteTagUnused: "Aucune transaction ne la porte.",
    confirmDeleteTag: "Oui, supprimer",
    tagDeleted: "Étiquette supprimée",
```

```ts
    tagNameTaken: "Une étiquette porte déjà ce nom.",
    tagMergeFailed: "Ces étiquettes n'ont pas pu être fusionnées.",
```

(French puts 0 in the singular, so `deleteTagUnused` is chosen in code for `uses === 0`; `deleteTagUses` is never asked for a zero.)

- [ ] **Step 2: The usage query**

In `apps/web/lib/queries/phase4.ts`, add to the imports:

```ts
import { tagUsageFromRows, type TagUsage } from "@finance/core/tags";
```

and after `getTags` add:

```ts
/**
 * Every tag with how many transactions carry it, for the Plan page.
 *
 * One request: PostgREST's embedded count runs under RLS, so a transaction in
 * the bin is not counted (see `@finance/core/tags`).
 */
export async function getTagUsage(userId: string): Promise<TagUsage[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tags")
    .select("id, name, transaction_tags(count)")
    .eq("user_id", userId)
    .order("name");

  if (error) {
    throw error;
  }
  return tagUsageFromRows(data ?? []);
}
```

- [ ] **Step 3: The actions**

Read `node_modules/next/dist/docs/01-app/01-getting-started/07-mutating-data.md` ("Revalidate data"). A `"use server"` file may export only async functions; the helper below stays unexported.

In `apps/web/lib/actions/phase4.ts`, directly above `export async function upsertTag(`, add:

```ts
/** A duplicate name, from `unique (user_id, name)` in 012, in the catalogue's words. */
function tagWriteError(error: { code?: string; message: string }): string {
  return error.code === "23505" ? "errors.tagNameTaken" : error.message;
}
```

In `upsertTag`, replace both `return { error: error.message };` with:

```ts
        return { error: tagWriteError(error) };
```

After `upsertTag`, add:

```ts
export async function renameTag(
  id: string,
  name: string,
): Promise<ActionResult> {
  const userId = await requireUserId();
  if (!userId) {
    return { error: "errors.notAuthenticated" };
  }
  const parsed = tagSchema.safeParse({ id, name });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "errors.invalidInput" };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("tags")
    .update({ name: parsed.data.name })
    .eq("id", id)
    .eq("user_id", userId);
  if (error) {
    return { error: tagWriteError(error) };
  }

  revalidatePhase4();
  return { success: true };
}

/** Deletes a tag; `transaction_tags` cascades, and the transactions stay. */
export async function deleteTag(id: string): Promise<ActionResult> {
  const userId = await requireUserId();
  if (!userId) {
    return { error: "errors.notAuthenticated" };
  }
  if (!parseUuid(id)) {
    return { error: "errors.invalidInput" };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("tags")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);
  if (error) {
    return { error: error.message };
  }

  revalidatePhase4();
  return { success: true };
}

/** Moves every transaction from one tag to another, then deletes the first (040). */
export async function mergeTags(
  fromId: string,
  intoId: string,
): Promise<ActionResult> {
  const userId = await requireUserId();
  if (!userId) {
    return { error: "errors.notAuthenticated" };
  }
  if (!parseUuid(fromId) || !parseUuid(intoId) || fromId === intoId) {
    return { error: "errors.tagMergeFailed" };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("merge_tags", {
    target_user: userId,
    from_tag: fromId,
    into_tag: intoId,
  });
  if (error) {
    return { error: "errors.tagMergeFailed" };
  }

  revalidatePhase4();
  return { success: true };
}
```

`revalidatePhase4` already covers `/budgets`, `/transactions`, `/calendar` and `/bearing`, every surface that shows a tag; the quick-add tags in the `(app)` layout are re-read with the page the action returns to.

- [ ] **Step 4: The Tags card**

Create `apps/web/components/finance/TagsCard.tsx`:

```tsx
"use client";

import { useActionState, useRef, useState, useTransition } from "react";
import type { FormEvent } from "react";
import { PencilSimple, Trash } from "@phosphor-icons/react";
import { Button } from "@/components/retroui/Button";
import { Input } from "@/components/retroui/Input";
import { FormLabel } from "@/components/layout/FormLabel";
import { useToast } from "@/components/layout/ToastProvider";
import {
  deleteTag,
  mergeTags,
  renameTag,
  upsertTag,
} from "@/lib/actions/phase4";
import { findRenameConflict, type TagUsage } from "@finance/core/tags";
import { cn } from "@/lib/utils";
import { ICON } from "@/lib/icon-scale";
import { useT } from "@/lib/locale-context";

type ActionResult = { error?: string; success?: boolean };

type Props = {
  tags: TagUsage[];
  /**
   * `tags.manage`. Off, the card is what it always was: the names and a
   * field to add one. On, each tag is a row that opens rename, merge and
   * delete.
   */
  manage: boolean;
};

/** The Plan page's Tags card. */
export function TagsCard({ tags, manage }: Props) {
  const t = useT();
  const { toast } = useToast();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [, addAction, addPending] = useActionState(
    async (previous: ActionResult, formData: FormData) => {
      const result = await upsertTag(previous, formData);
      if (result.success) {
        toast(t("plan.tagAdded"), "success");
      } else if (result.error) {
        toast(result.error, "error");
      }
      return result;
    },
    {},
  );

  // The row that opened the editor may be gone (merged, deleted), so focus
  // goes back to the card's heading rather than to nothing.
  function closeEditor() {
    setEditingId(null);
    headingRef.current?.focus();
  }

  return (
    <section className="flex flex-col gap-3 rounded-card p-card border border-border bg-card">
      <h2
        ref={headingRef}
        tabIndex={-1}
        className="text-sm font-medium outline-none"
      >
        {t("plan.tagsHeading")}
      </h2>
      <p className="text-sm text-muted-foreground">{t("plan.tagsBlurb")}</p>

      {tags.length > 0 && manage ? (
        <ul className="flex flex-col divide-y divide-border">
          {tags.map((tag) => {
            const open = editingId === tag.id;
            return (
              <li key={tag.id} className="flex flex-col">
                <div className="flex min-h-14 items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{tag.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {t("ledger.entryCount", { count: tag.uses })}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEditingId(open ? null : tag.id)}
                    aria-expanded={open}
                    aria-label={t("plan.editTagNamed", { name: tag.name })}
                    className={cn(
                      "flex h-11 w-11 shrink-0 items-center justify-center",
                      "rounded-full border border-border hover:bg-accent",
                    )}
                  >
                    <PencilSimple size={ICON.lg} weight="light" />
                  </button>
                </div>
                {open ? (
                  <TagEditor tag={tag} tags={tags} onDone={closeEditor} />
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : tags.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {tags.map((tag) => (
            <span
              key={tag.id}
              className={cn(
                "rounded-full border border-border bg-muted",
                "px-3 py-1 text-xs font-medium",
              )}
            >
              {tag.name}
            </span>
          ))}
        </div>
      ) : null}

      <form action={addAction} className="flex flex-wrap items-end gap-3">
        <div className="flex min-w-48 flex-1 flex-col gap-2">
          <FormLabel htmlFor="tag-name">{t("plan.newTag")}</FormLabel>
          <Input id="tag-name" name="name" required maxLength={40} />
        </div>
        <Button type="submit" variant="outline" disabled={addPending}>
          {t("plan.addTag")}
        </Button>
      </form>
    </section>
  );
}

/** Rename, merge or delete one tag, under its row. */
function TagEditor({
  tag,
  tags,
  onDone,
}: {
  tag: TagUsage;
  tags: TagUsage[];
  onDone: () => void;
}) {
  const t = useT();
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState(tag.name);
  const [clash, setClash] = useState<TagUsage | null>(null);
  const [intoId, setIntoId] = useState("");
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const others = tags.filter((other) => other.id !== tag.id);
  const into = others.find((other) => other.id === intoId) ?? null;
  const renameId = `tag-rename-${tag.id}`;
  const mergeId = `tag-merge-${tag.id}`;

  function run(action: () => Promise<ActionResult>, done: string) {
    startTransition(async () => {
      const result = await action();
      if (result.error) {
        toast(result.error, "error");
        return;
      }
      toast(done, "success");
      onDone();
    });
  }

  function handleRename(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const found = findRenameConflict(tags, tag.id, name);
    if (found) {
      setClash(found);
      return;
    }
    run(() => renameTag(tag.id, name), t("plan.tagRenamed"));
  }

  function merge(target: TagUsage) {
    run(() => mergeTags(tag.id, target.id), t("plan.tagMerged"));
  }

  return (
    <div className="flex flex-col gap-4 border-t border-border pb-4 pt-3">
      <form onSubmit={handleRename} className="flex flex-wrap items-end gap-3">
        <div className="flex min-w-48 flex-1 flex-col gap-2">
          <FormLabel htmlFor={renameId}>{t("plan.tagName")}</FormLabel>
          <Input
            id={renameId}
            value={name}
            onChange={(event) => {
              setName(event.target.value);
              setClash(null);
            }}
            required
            maxLength={40}
          />
        </div>
        <Button type="submit" variant="outline" disabled={pending}>
          {t("plan.renameTag")}
        </Button>
      </form>

      {clash ? (
        <div
          role="status"
          className="flex flex-wrap items-center gap-3 text-sm"
        >
          <span>{t("plan.tagNameExists", { name: clash.name })}</span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={pending}
            onClick={() => merge(clash)}
          >
            {t("plan.mergeIntoNamed", { name: clash.name })}
          </Button>
        </div>
      ) : null}

      {others.length > 0 ? (
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex min-w-48 flex-1 flex-col gap-2">
            <FormLabel htmlFor={mergeId}>{t("plan.mergeTagInto")}</FormLabel>
            <select
              id={mergeId}
              value={intoId}
              onChange={(event) => setIntoId(event.target.value)}
              aria-describedby={`${mergeId}-hint`}
              className={cn(
                "h-11 w-full rounded-control border border-border",
                "bg-background px-3 text-base",
              )}
            >
              <option value="">{t("plan.chooseTag")}</option>
              {others.map((other) => (
                <option key={other.id} value={other.id}>
                  {other.name}
                </option>
              ))}
            </select>
          </div>
          <Button
            type="button"
            variant="outline"
            disabled={pending || into === null}
            onClick={() => {
              if (into) {
                merge(into);
              }
            }}
          >
            {t("plan.mergeTag")}
          </Button>
          <p
            id={`${mergeId}-hint`}
            className="w-full text-xs text-muted-foreground"
          >
            {t("plan.mergeTagHint", { name: tag.name })}
          </p>
        </div>
      ) : null}

      {confirmingDelete ? (
        <div className="flex flex-col gap-2">
          <p className="text-sm">
            {tag.uses === 0
              ? t("plan.deleteTagUnused")
              : t("plan.deleteTagUses", { count: tag.uses })}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              className="border-destructive text-destructive"
              disabled={pending}
              onClick={() =>
                run(() => deleteTag(tag.id), t("plan.tagDeleted"))
              }
            >
              {t("plan.confirmDeleteTag")}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => setConfirmingDelete(false)}
            >
              {t("common.cancel")}
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="link"
            className="text-destructive"
            disabled={pending}
            onClick={() => setConfirmingDelete(true)}
          >
            <Trash size={ICON.md} weight="light" className="mr-1.5" />
            {t("plan.deleteTag")}
          </Button>
          <Button type="button" variant="outline" onClick={onDone}>
            {t("plan.cancel")}
          </Button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 5: BudgetsView renders the card**

In `apps/web/app/(app)/budgets/BudgetsView.tsx`:

- Remove `upsertTag,` from the `@/lib/actions/phase4` import, and `Tag,` from the `@finance/core/types/database` import.
- Add the imports:

```tsx
import { TagsCard } from "@/components/finance/TagsCard";
import type { TagUsage } from "@finance/core/tags";
```

- In `Props`, replace `tags: Tag[];` with:

```tsx
  tags: TagUsage[];
  /** `tags.manage`, read on the server. */
  manageTags: boolean;
```

- Add `manageTags,` to the destructured props after `tags,`.
- Delete the `tagAction` hook (the `const [, tagAction, tagPending] = useActionState(…)` block, lines 157-168).
- Replace the whole Tags `<section>` (lines 534-561) with:

```tsx
        <TagsCard tags={tags} manage={manageTags} />
```

`useActionState` is still used by the budget and goal forms; leave the React import as it is.

- [ ] **Step 6: The page reads the flag and the counts**

In `apps/web/app/(app)/budgets/page.tsx`:

- In the `@/lib/queries/phase4` import, replace `getTags,` with `getTagUsage,`.
- Add the imports:

```tsx
import { isFlagOn } from "@finance/core/flags";
import { getFlags } from "@/lib/flags";
```

- In the `Promise.all`, replace `getTags(user.id),` with `getTagUsage(user.id),`, and add `flags,` as the last destructured name with `getFlags(),` as the last entry of the array.
- On `<BudgetsView`, after `tags={tags}` add:

```tsx
      manageTags={isFlagOn(flags, "tags.manage")}
```

- [ ] **Step 7: Gates**

Run: `pnpm --filter @finance/core exec tsc --noEmit && pnpm --filter web exec tsc --noEmit && pnpm --filter web exec eslint --max-warnings 0 . && pnpm --filter @finance/core test && pnpm --filter web test`
Expected: all pass. The unused-keys test passes: every key added in Step 1 is read by `TagsCard.tsx` or the actions. `pnpm check:reachability` still reports `useFlag` (Task 8) and nothing else.

- [ ] **Step 8: Check in the browser**

Against a database with 039 and 040 applied: either the local stack (`apps/web/.env.local` pointed at `http://127.0.0.1:54321` with the local anon key; sign up, and read the confirmation mail at `http://127.0.0.1:54324`), or the hosted project once the user has applied both migrations there.

1. Flag off: `/budgets` shows the Tags card exactly as before (names and the add field).
2. Switch it on for your account (SQL editor, or `docker exec … psql`): `insert into user_feature_flags (user_id, flag_key, enabled) values ('<your id>', 'tags.manage', true) on conflict (user_id, flag_key) do update set enabled = true;` then reload `/budgets`.
3. Each tag is a 56 px row with its transaction count and a pencil button. The button's name reads "Edit the tag …" in a screen reader.
4. Rename a tag: the toast says "Tag renamed", and `/transactions` shows the new name on its rows.
5. Rename it onto another tag's exact name: no request is sent, the line "… already exists." appears with "Merge into …"; pressing it merges.
6. Merge via the select: the kept tag's count rises by the moved transactions minus any that carried both; the merged tag disappears; focus lands on the Tags heading.
7. Delete: the confirmation states the count ("It comes off 3 transactions; the transactions stay.", or "No transaction carries it." for an unused tag); "Yes, delete" removes the tag and the transactions remain.
8. In French (`/profile` language), the same strings read in French with the no-break space before ";".

- [ ] **Step 9: Commit**

```bash
npx prettier --write packages/core/src/i18n/messages/en.ts packages/core/src/i18n/messages/fr.ts apps/web/lib/queries/phase4.ts apps/web/lib/actions/phase4.ts apps/web/components/finance/TagsCard.tsx "apps/web/app/(app)/budgets/BudgetsView.tsx" "apps/web/app/(app)/budgets/page.tsx"
git add packages/core/src/i18n/messages/en.ts packages/core/src/i18n/messages/fr.ts apps/web/lib/queries/phase4.ts apps/web/lib/actions/phase4.ts apps/web/components/finance/TagsCard.tsx "apps/web/app/(app)/budgets/BudgetsView.tsx" "apps/web/app/(app)/budgets/page.tsx"
git commit -m "$(cat <<'EOF'
Rename, merge and delete tags on the web Plan page, behind tags.manage

With the flag on, each tag on the Plan page is a row with its transaction
count that opens rename, merge and delete. A rename onto a name in use
offers to merge instead, and the delete says how many transactions lose
the tag. A duplicate name from the server now reads as the catalogue's
sentence rather than Postgres's. With the flag off the card is unchanged.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 8: Phone — rename, merge and delete from the Plan screen

**Files:**
- Modify: `packages/core/src/i18n/messages/en.ts`, `fr.ts` (`plan`, `common`)
- Modify: `apps/mobile/src/lib/queries.ts:451-460` (and imports)
- Modify: `apps/mobile/src/lib/mutations.ts:1222-1238` (and append)
- Create: `apps/mobile/src/components/TagEditSheet.tsx`
- Modify: `apps/mobile/src/components/ui/ConfirmSheet.tsx`
- Modify: `apps/mobile/src/app/(tabs)/planning.tsx:24-29,55-72,124-135,176,188-227,293-303,583-606`

**Interfaces:**
- Consumes: `useFlag` (Task 4), `merge_tags` (Task 5), `tagUsageFromRows`, `findRenameConflict`, `TagUsage` (Task 6), the Task 7 message keys, `notifyDataChanged` (`lib/data-version.ts`).
- Produces: `getTagUsage(userId): Promise<TagUsage[]>`; mutations `renameTag(id, name)`, `deleteTag(id)`, `mergeTags(fromId, intoId)`; `TagEditSheet({ tag, tags, onClose, onChanged })`; message keys `plan.editTag`, `plan.tagManageHint`, `common.delete`, `common.working`.

- [ ] **Step 1: Messages**

In `en.ts`, in the `plan` block after the Task 7 keys (`tagDeleted`), add:

```ts
    /** The phone's tag sheet: its title, and the line that says chips open it. */
    editTag: "Edit tag",
    tagManageHint: "Tap a tag to rename, merge or delete it.",
```

In the `common` block after `cancel: "Cancel",`, add:

```ts
    delete: "Delete",
    working: "Working…",
```

In `fr.ts`, at the same positions:

```ts
    editTag: "Modifier l'étiquette",
    tagManageHint:
      "Touchez une étiquette pour la renommer, la fusionner ou la supprimer.",
```

```ts
    delete: "Supprimer",
    working: "En cours…",
```

- [ ] **Step 2: The confirm sheet speaks the reader's language**

`ConfirmSheet` is on the Plan screen, and its defaults were English whatever the language. In `apps/mobile/src/components/ui/ConfirmSheet.tsx`, replace:

```tsx
  confirmLabel = "Delete",
  cancelLabel = "Cancel",
```

with:

```tsx
  confirmLabel,
  cancelLabel,
```

and replace:

```tsx
              label={pending ? "Working…" : confirmLabel}
```

with:

```tsx
              label={
                pending ? t("common.working") : (confirmLabel ?? t("common.delete"))
              }
```

and `label={cancelLabel}` with `label={cancelLabel ?? t("common.cancel")}`.

- [ ] **Step 3: The usage query**

In `apps/mobile/src/lib/queries.ts`, add to the imports:

```ts
import { tagUsageFromRows, type TagUsage } from "@finance/core/tags";
```

and after `getTags` add:

```ts
/** Every tag with how many transactions carry it, for the Plan screen. */
export async function getTagUsage(userId: string): Promise<TagUsage[]> {
  const { data, error } = await supabase
    .from("tags")
    .select("id, name, transaction_tags(count)")
    .eq("user_id", userId)
    .order("name");
  if (error) {
    throw error;
  }
  return tagUsageFromRows(data ?? []);
}
```

- [ ] **Step 4: The mutations**

In `apps/mobile/src/lib/mutations.ts`, directly above `export async function upsertTag(`, add:

```ts
/** A duplicate name, from `unique (user_id, name)` in 012, in the catalogue's words. */
function tagWriteError(error: { code?: string; message: string }): string {
  return error.code === "23505" ? "errors.tagNameTaken" : error.message;
}
```

In `upsertTag`, replace `return { error: error.message };` with `return { error: tagWriteError(error) };`. After `upsertTag`, add:

```ts
export async function renameTag(
  id: string,
  name: string,
): Promise<ActionResult> {
  const userId = await requireUserId();
  if (!userId) {
    return { error: "errors.notAuthenticated" };
  }
  const parsed = tagSchema.safeParse({ id, name });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "errors.invalidInput" };
  }
  const { error } = await supabase
    .from("tags")
    .update({ name: parsed.data.name })
    .eq("id", id)
    .eq("user_id", userId);
  if (error) {
    return { error: tagWriteError(error) };
  }
  return { success: true };
}

/** Deletes a tag; `transaction_tags` cascades, and the transactions stay. */
export async function deleteTag(id: string): Promise<ActionResult> {
  const userId = await requireUserId();
  if (!userId) {
    return { error: "errors.notAuthenticated" };
  }
  const { error } = await supabase
    .from("tags")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);
  if (error) {
    return { error: error.message };
  }
  return { success: true };
}

/** Moves every transaction from one tag to another, then deletes the first (040). */
export async function mergeTags(
  fromId: string,
  intoId: string,
): Promise<ActionResult> {
  const userId = await requireUserId();
  if (!userId) {
    return { error: "errors.notAuthenticated" };
  }
  const { error } = await supabase.rpc("merge_tags", {
    target_user: userId,
    from_tag: fromId,
    into_tag: intoId,
  });
  if (error) {
    return { error: "errors.tagMergeFailed" };
  }
  return { success: true };
}
```

- [ ] **Step 5: The tag sheet**

Create `apps/mobile/src/components/TagEditSheet.tsx`:

```tsx
import { useState } from "react";
import { Modal, Pressable, ScrollView, View } from "react-native";

import { findRenameConflict, type TagUsage } from "@finance/core/tags";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { SheetGrabber } from "@/components/ui/SheetGrabber";
import { Text } from "@/components/ui/Text";
import { cn } from "@/lib/cn";
import { deleteTag, mergeTags, renameTag } from "@/lib/mutations";
import { useT } from "@/providers/LocaleProvider";
import { useToast } from "@/providers/ToastProvider";

interface TagEditSheetProps {
  /** The tag being edited; null closes the sheet. */
  tag: TagUsage | null;
  /** Every tag: the merge targets, and what a rename could clash with. */
  tags: TagUsage[];
  onClose: () => void;
  /** After a rename, merge or delete, so every screen reloads. */
  onChanged: () => void;
}

/**
 * Rename, merge or delete one tag (`tags.manage`).
 *
 * The delete asks inside the sheet rather than in a ConfirmSheet on top of
 * it: two modals in a row is the case React Native on iOS drops the second
 * of, and the web asks inline too.
 */
export function TagEditSheet({
  tag,
  tags,
  onClose,
  onChanged,
}: TagEditSheetProps) {
  const t = useT();
  return (
    <Modal
      visible={tag !== null}
      animationType="slide"
      transparent
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View className="flex-1 justify-end bg-black/50">
        <Pressable
          className="flex-1"
          accessibilityLabel={t("common.closeSheet")}
          onPress={onClose}
        />
        <View className="max-h-[90%] rounded-t-card border border-border bg-card">
          <View className="items-center pt-3">
            <SheetGrabber />
          </View>
          {tag ? (
            <TagEditor
              key={tag.id}
              tag={tag}
              tags={tags}
              onClose={onClose}
              onChanged={onChanged}
            />
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

function TagEditor({
  tag,
  tags,
  onClose,
  onChanged,
}: {
  tag: TagUsage;
  tags: TagUsage[];
  onClose: () => void;
  onChanged: () => void;
}) {
  const t = useT();
  const { toast } = useToast();
  const [name, setName] = useState(tag.name);
  const [clash, setClash] = useState<TagUsage | null>(null);
  const [intoId, setIntoId] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [pending, setPending] = useState(false);
  const others = tags.filter((other) => other.id !== tag.id);
  const into = others.find((other) => other.id === intoId) ?? null;

  async function run(
    action: () => Promise<{ error?: string }>,
    done: string,
  ) {
    setPending(true);
    const result = await action();
    setPending(false);
    if (result.error) {
      toast(result.error, "error");
      return;
    }
    toast(done, "success");
    onChanged();
    onClose();
  }

  function handleRename() {
    const found = findRenameConflict(tags, tag.id, name);
    if (found) {
      setClash(found);
      return;
    }
    void run(() => renameTag(tag.id, name), t("plan.tagRenamed"));
  }

  function merge(target: TagUsage) {
    void run(() => mergeTags(tag.id, target.id), t("plan.tagMerged"));
  }

  return (
    <>
      <View className="flex-row items-center justify-between px-5 pb-2 pt-3">
        <Text className="font-semibold" style={{ fontSize: 18 }}>
          {t("plan.editTag")}
        </Text>
        <Pressable
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={t("common.close")}
          hitSlop={8}
          className="min-h-11 justify-center"
        >
          <Text variant="muted">{t("common.close")}</Text>
        </Pressable>
      </View>

      <ScrollView
        className="px-5"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text variant="muted" className="mb-4 text-sm">
          {t("ledger.entryCount", { count: tag.uses })}
        </Text>

        <Text variant="label" className="mb-2">
          {t("plan.tagName")}
        </Text>
        <Input
          value={name}
          onChangeText={(value) => {
            setName(value);
            setClash(null);
          }}
          maxLength={40}
          accessibilityLabel={t("plan.tagName")}
          className="mb-3"
        />
        {clash ? (
          <View className="mb-3 gap-2" accessibilityLiveRegion="polite">
            <Text className="text-sm">
              {t("plan.tagNameExists", { name: clash.name })}
            </Text>
            <Button
              label={t("plan.mergeIntoNamed", { name: clash.name })}
              variant="outline"
              disabled={pending}
              onPress={() => merge(clash)}
            />
          </View>
        ) : null}
        <Button
          label={t("plan.renameTag")}
          variant="outline"
          disabled={pending}
          onPress={handleRename}
          className="mb-6"
        />

        {others.length > 0 ? (
          <>
            <Text variant="label" className="mb-2">
              {t("plan.mergeTagInto")}
            </Text>
            <View className="mb-2 flex-row flex-wrap gap-2">
              {others.map((other) => {
                const selected = other.id === intoId;
                return (
                  <Pressable
                    key={other.id}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    onPress={() => setIntoId(selected ? null : other.id)}
                    className={cn(
                      "min-h-11 justify-center rounded-full border px-4",
                      selected
                        ? "border-foreground bg-foreground"
                        : "border-border bg-background",
                    )}
                  >
                    <Text
                      className={cn(
                        "text-sm font-semibold",
                        selected ? "text-background" : "text-muted-foreground",
                      )}
                    >
                      {other.name}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <Text variant="muted" className="mb-3 text-xs">
              {t("plan.mergeTagHint", { name: tag.name })}
            </Text>
            <Button
              label={t("plan.mergeTag")}
              variant="outline"
              disabled={pending || into === null}
              onPress={() => {
                if (into) {
                  merge(into);
                }
              }}
              className="mb-6"
            />
          </>
        ) : null}

        {confirmingDelete ? (
          <View className="mb-8 gap-2">
            <Text className="text-sm">
              {tag.uses === 0
                ? t("plan.deleteTagUnused")
                : t("plan.deleteTagUses", { count: tag.uses })}
            </Text>
            <Button
              label={pending ? t("common.working") : t("plan.confirmDeleteTag")}
              variant="outline"
              className="border-destructive"
              disabled={pending}
              onPress={() =>
                void run(() => deleteTag(tag.id), t("plan.tagDeleted"))
              }
            />
            <Button
              label={t("common.cancel")}
              variant="ghost"
              disabled={pending}
              onPress={() => setConfirmingDelete(false)}
            />
          </View>
        ) : (
          <Button
            label={t("plan.deleteTag")}
            variant="ghost"
            className="mb-8"
            disabled={pending}
            onPress={() => setConfirmingDelete(true)}
          />
        )}
      </ScrollView>
    </>
  );
}
```

- [ ] **Step 6: The Plan screen opens it**

In `apps/mobile/src/app/(tabs)/planning.tsx`:

- Remove `Tag,` from the `@finance/core/types/database` import, `getTags,` from the `@/lib/queries` import, and add `getTagUsage,` there in alphabetical position.
- Add the imports:

```tsx
import type { TagUsage } from "@finance/core/tags";
import { TagEditSheet } from "@/components/TagEditSheet";
import { useFlag } from "@/providers/FlagsProvider";
```

- After `const [pending, setPending] = useState(false);` add:

```tsx
  const manageTags = useFlag("tags.manage");
  const [editingTag, setEditingTag] = useState<TagUsage | null>(null);
```

- In the signed-out default, replace `tags: [] as Tag[],` with `tags: [] as TagUsage[],`; in the `Promise.all`, replace `getTags(user.id),` with `getTagUsage(user.id),`.
- In `handleAddTag`, replace the final `await onRefresh();` with:

```tsx
    // Other screens list tags too (the quick-add sheet, the calendar's
    // forms); until now a new tag reached them only when they reloaded.
    notifyDataChanged();
    await onRefresh();
```

- Replace the tag chips (the `<View className="mt-3 flex-row flex-wrap gap-2">` block and the `.map((t) => …)` inside it, which also shadowed the translator) with:

```tsx
            <View className="mt-3 flex-row flex-wrap gap-2">
              {(data?.tags ?? []).map((tag) =>
                manageTags ? (
                  <Pressable
                    key={tag.id}
                    accessibilityRole="button"
                    accessibilityLabel={t("plan.editTagNamed", {
                      name: tag.name,
                    })}
                    onPress={() => setEditingTag(tag)}
                    className="min-h-11 justify-center rounded-full border border-border bg-muted px-4"
                  >
                    <Text className="text-sm font-semibold">{tag.name}</Text>
                  </Pressable>
                ) : (
                  <View
                    key={tag.id}
                    className="rounded-full border border-border bg-muted px-3 py-1"
                  >
                    <Text className="text-xs font-semibold">{tag.name}</Text>
                  </View>
                ),
              )}
            </View>
            {manageTags && (data?.tags.length ?? 0) > 0 ? (
              <Text variant="muted" className="mt-2 text-xs">
                {t("plan.tagManageHint")}
              </Text>
            ) : null}
```

- Directly before `<ConfirmSheet` near the end of the screen, add:

```tsx
      <TagEditSheet
        tag={editingTag}
        tags={data?.tags ?? []}
        onClose={() => setEditingTag(null)}
        onChanged={() => {
          notifyDataChanged();
          void onRefresh();
        }}
      />
```

- [ ] **Step 7: Gates, reachability included from here**

Run: `pnpm --filter @finance/core exec tsc --noEmit && pnpm --filter mobile exec tsc --noEmit && pnpm --filter mobile exec expo lint --max-warnings 0 && pnpm --filter @finance/core test && pnpm check:reachability`
Expected: all pass, with knip reporting nothing.

- [ ] **Step 8: Check on the phone**

With the flag on for your account (Task 7, Step 8), relaunch the app so the session reads it.

1. Plan: tags are 44 px chips with the line "Tap a tag to rename, merge or delete it."
2. Tap a tag: the sheet shows its count, a name field, the other tags as chips, and "Delete tag".
3. Rename onto an existing name: "… already exists." with "Merge into …"; pressing it merges, and the sheet closes.
4. Merge via the chips: the kept tag remains and the merged one is gone from Plan, from the quick-add sheet (open it) and from the transaction form.
5. Delete: the sheet states the count; "Yes, delete" removes the tag.
6. Long-press a cap: its ConfirmSheet reads "Supprimer" / "Annuler" in French.
7. Switch the flag off, relaunch: the chips are plain again and do not open anything.

- [ ] **Step 9: Commit**

```bash
npx prettier --write packages/core/src/i18n/messages/en.ts packages/core/src/i18n/messages/fr.ts apps/mobile/src/lib/queries.ts apps/mobile/src/lib/mutations.ts apps/mobile/src/components/TagEditSheet.tsx apps/mobile/src/components/ui/ConfirmSheet.tsx "apps/mobile/src/app/(tabs)/planning.tsx"
git add packages/core/src/i18n/messages/en.ts packages/core/src/i18n/messages/fr.ts apps/mobile/src/lib/queries.ts apps/mobile/src/lib/mutations.ts apps/mobile/src/components/TagEditSheet.tsx apps/mobile/src/components/ui/ConfirmSheet.tsx "apps/mobile/src/app/(tabs)/planning.tsx"
git commit -m "$(cat <<'EOF'
Rename, merge and delete tags on the phone, behind tags.manage

With the flag on, a tag on the Plan screen opens a sheet with its count,
rename, merge and delete, as on the web: a rename onto a name in use
offers the merge, and the delete says how many transactions lose the
tag. Every tag change now tells the other screens, so the quick-add sheet
no longer lists a tag that is gone. The confirm sheet's own labels are
translated.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 9: Close Plan 0.2

**Files:**
- Modify: `docs/how-pluclair-works.md`

**Interfaces:**
- Consumes: everything above.
- Produces: an up-to-date app guide and a green `main`.

- [ ] **Step 1: Every gate**

Run, from the repository root:

```bash
pnpm --filter @finance/core exec tsc --noEmit
pnpm --filter web exec tsc --noEmit
pnpm --filter mobile exec expo customize tsconfig.json && pnpm --filter mobile exec tsc --noEmit
pnpm --filter @finance/core test
pnpm --filter web test
pnpm --filter web exec eslint --max-warnings 0 .
pnpm --filter mobile exec expo lint --max-warnings 0
pnpm check:reachability
npx supabase db reset
for f in supabase/tests/*.test.sql; do docker exec -i supabase_db_finance-tracker psql -U postgres -q -v ON_ERROR_STOP=1 < "$f" || exit 1; done
```

Expected: every command exits 0.

- [ ] **Step 2: Update the guide**

In `docs/how-pluclair-works.md`:

- Change `Last updated:` to `Phase 0, Plan 0.2 — closed (<today's date>).`
- In **Shape**, change `Migrations \`001\`–\`038\`` to `Migrations \`001\`–\`040\``.
- In **Gates**, replace the migrations sentence with:

```markdown
Migrations: `npx supabase start`, `npx supabase db reset`, then every
assertion script:
`for f in supabase/tests/*.test.sql; do docker exec -i supabase_db_finance-tracker psql -U postgres -q -v ON_ERROR_STOP=1 < "$f" || break; done`.
```

- After **Bank feed**, add:

````markdown
## Feature flags

Evaluated in Postgres by `evaluated_feature_flags()` (migration `039`), so
both clients get the same answer: an account's override wins; otherwise a
flag is on when `enabled_by_default` is true or the account was created at or
after `enabled_from`. No session can read the flag tables. The web asks once
per request (`apps/web/lib/flags.ts`); the phone asks once per session and
keeps the last answer per account (`apps/mobile/src/lib/flags.ts`,
`FlagsProvider`). A flag the database does not return, or a key this build
does not list (`packages/core/src/flags.ts`), is off.

| Flag          | Gates                                           | Default |
| ------------- | ----------------------------------------------- | ------- |
| `tags.manage` | Rename, merge and delete tags on the Plan page  | off     |

Switched with SQL (the dashboard's SQL editor, or the service role):

```sql
-- On for one account
insert into user_feature_flags (user_id, flag_key, enabled)
values ('<account id>', 'tags.manage', true)
on conflict (user_id, flag_key) do update set enabled = excluded.enabled;

-- On for every account created from now on
update feature_flags set enabled_from = now() where key = 'tags.manage';

-- On for everyone
update feature_flags set enabled_by_default = true where key = 'tags.manage';
```
````

- In **Known issues**, add:

```markdown
- The SQL assertion scripts in `supabase/tests/` are run by hand against a
  local stack; CI does not run them.
- The phone reads flags once per session, so a switched flag reaches it at
  its next launch or sign-in.
- A web quick-add queued offline whose tag is deleted before it is sent is
  saved with no tags: the tag insert fails after the transaction is written,
  and the outbox drops the error (`saveQuickTransaction`,
  `lib/offline-outbox.ts`).
```

- [ ] **Step 3: Commit**

```bash
npx prettier --write docs/how-pluclair-works.md
git add docs/how-pluclair-works.md
git commit -m "$(cat <<'EOF'
Close Plan 0.2 in the app guide

Feature flags get their own section, with the statements that switch
them; the guide lists migrations to 040, runs every assertion script, and
records three known issues found on the way.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 4: Hand back**

Report to the user, leading with what they will see: nothing, until they switch `tags.manage` on. Then, on both clients, each tag on the Plan page opens rename, merge and delete. Say what is deliberately unchanged: every figure, every AI output, and the Tags card for anyone with the flag off. Then give:

- **The dashboard steps only they can do:** apply `039_feature_flags.sql`, then `040_merge_tags.sql`, to the hosted project in that order; then switch `tags.manage` on for their own account with the SQL in the guide to try it. The code is safe to deploy before the migrations: without `039` every flag reads as off, and nothing calls `merge_tags` while the flag is off.
- That Plan 0.3 (the reference data registry, which adds the flag `reference.provenance`) is next.

Offer to push `main`.

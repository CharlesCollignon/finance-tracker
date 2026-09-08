-- What language a read was written in.
--
-- 024 stores a read as prose with holes in it — `{{fact:unrecorded}}` rather
-- than "1 650,50 €" — and the app fills the holes at render time from the
-- figures as they stand now. That is what lets the currency toggle and the
-- privacy blur work on a written paragraph.
--
-- It also means the labels in a rendered read come from whatever language the
-- reader is in *now*, not from the language the sentences were written in. A
-- read composed in French and then read after switching to English came back
-- as French prose with English labels dropped into it — "vos
-- {{fact:unrecorded}}" rendering as "vos Unrecorded spending". Each half was
-- right on its own; together they were nonsense.
--
-- So the language goes on the row. A stored read is rendered with the labels
-- of the language it was written in, whatever the reader has since chosen,
-- and the card says which language that was so the mismatch is stated rather
-- than merely survived.
--
-- Nullable, with no backfill. A read written before this column existed was
-- written under an English-only app, so null means English — but recording
-- that as a default would claim knowledge the app does not have about rows
-- it did not write. `parseLocale(row.locale) ?? DEFAULT_LOCALE` reads the
-- absence correctly, and costs nothing.
--
-- The prompt version in 024 moves to 3 in the same change. It does not
-- invalidate anything, for the reason its own comment gives: re-writing every
-- stored read because the prompt changed would spend a user's whole monthly
-- allowance on a change they never asked for.

alter table month_reads
  add column locale text
    check (locale is null or locale in ('en', 'fr'));

/* ------------------------------------------------- writing it down */

-- `store_month_read` gains the language, which means a new signature.
--
-- Adding a trailing parameter to a Postgres function does not replace it, it
-- overloads it — the ten-argument version would still be there, still
-- callable, and still writing rows with no language on them. So the old one
-- is dropped by name and the new one created whole.
--
-- Recreated rather than patched for the reason 025 gives: `create or replace`
-- is the only way to change a function body, so the whole thing is restated
-- and the only differences from its 025 self are the parameter and the one
-- assignment that uses it.
--
-- The `acting_for` guard is unchanged and is the reason this is safe to call
-- at all; see 025 for what it fixed and why the absence of an `auth.uid()`
-- must never be read as permission.
drop function if exists store_month_read(
  uuid, date, jsonb, jsonb, text, smallint, text, smallint, smallint, text
);

create function store_month_read(
  target_user uuid,
  target_month date,
  new_read jsonb,
  new_facts jsonb,
  new_digest text,
  new_trimmed smallint,
  new_model text,
  new_prompt_version smallint,
  refused_delta smallint,
  new_source text,
  new_locale text
)
returns month_reads
language plpgsql
security definer
set search_path = public
as $$
declare
  result month_reads;
begin
  if not acting_for(target_user) then
    raise exception 'store_month_read: not permitted for that user';
  end if;

  update month_reads
     set pending_since = null,
         last_written_at = now(),
         refused = month_reads.refused + coalesce(refused_delta, 0),
         read = coalesce(new_read, month_reads.read),
         facts = case when new_read is null then month_reads.facts else new_facts end,
         facts_digest = case when new_read is null then month_reads.facts_digest else new_digest end,
         trimmed = case when new_read is null then month_reads.trimmed else coalesce(new_trimmed, 0) end,
         model = case when new_read is null then month_reads.model else new_model end,
         prompt_version = case when new_read is null then month_reads.prompt_version else new_prompt_version end,
         written_at = case when new_read is null then month_reads.written_at else now() end,
         -- Only set alongside a read. A refused attempt leaves the stored
         -- prose alone, and so must leave its language alone too.
         locale = case when new_read is null then month_reads.locale else new_locale end,
         source = case when new_read is null then month_reads.source else coalesce(new_source, 'pressed') end
   where user_id = target_user and month = target_month
  returning * into result;

  return result;
end;
$$;

-- A brand-new function gets the default PUBLIC grant, which is exactly the
-- mistake 025 exists to correct. Taking it away is part of creating one.
revoke execute on function store_month_read(
  uuid, date, jsonb, jsonb, text, smallint, text, smallint, smallint, text, text
) from public, anon;

grant execute on function store_month_read(
  uuid, date, jsonb, jsonb, text, smallint, text, smallint, smallint, text, text
) to authenticated, service_role;

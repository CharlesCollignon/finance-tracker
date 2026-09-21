-- What an instrument holds, so the app can stop offering to look for
-- something that was never there.
--
-- `032` stores a reading's countries and sectors, and the look-through treats
-- a reading with neither as a gap: read, incomplete, worth reading again. For
-- most instruments that is right — a factsheet that published only a TER may
-- well publish more next time. For some it is not right and never will be. A
-- physically-backed gold ETC holds one metal; it sits in no country and is in
-- no sector, and a second reading of it cannot find a breakdown that does not
-- exist. The surface offered one anyway, because nothing in the schema could
-- tell "the factsheet was thin" from "there is nothing to find".
--
-- ## Why the reader answers this and not a table
--
-- `packages/core/src/etf-shortlist.ts` already carries an `assetClass`, and
-- adding the common gold ETCs to it would fix the reported case in an
-- afternoon with no migration at all. It was rejected because the shortlist
-- is a hand-curated catalogue of the funds this app will *name*, and a
-- portfolio holds whatever its owner bought. The next commodity ETC off the
-- list lands in the same wrong group, and the fix is another commit.
--
-- The reader already opens the issuer's own page. "This is a physically
-- backed gold ETC" is exactly the kind of published fact it is there to
-- report, and a reading that carries it answers the question for every
-- instrument rather than for the ones somebody remembered.
--
-- ## Nullable, and why nothing backfills it
--
-- Every reading taken before this column existed has `null` here, which means
-- "not asked" rather than "has no composition" — and `resolvesToComposition`
-- in core reads a null as having a composition, which is what every reading
-- meant until now. A backfill would have to guess, and guessing "commodity"
-- over a fund would hide a real breakdown behind a sentence saying there
-- isn't one.
--
-- Instead `READING_VERSION` goes to 2, so `readingIsStale` puts every
-- existing reading back in the queue and the answer arrives from the reader
-- the same way every other figure in the table did. A portfolio's worth of
-- re-reads is a few pence.

alter table instrument_readings
  add column if not exists asset_kind text;

-- The vocabulary is closed and lives in `instrument-reading.ts`, exactly as
-- the sector ids do and for the reason `032` gives: a kind added to that list
-- should not need a migration. What is checked here is only that the column
-- holds one of the kinds or nothing at all — a constraint that would have to
-- be relaxed to add one is a constraint that will be relaxed in a hurry.
alter table instrument_readings
  drop constraint if exists instrument_readings_asset_kind_known;
alter table instrument_readings
  add constraint instrument_readings_asset_kind_known
  check (asset_kind is null or asset_kind ~ '^[a-z]+$');

comment on column instrument_readings.asset_kind is
  'What the instrument holds: companies, bonds, commodity or crypto. Null on a reading taken before the reader was asked, which means "not asked" and not "holds nothing".';

-- The writer, with the new field.
--
-- The eleven-argument form is dropped rather than left beside this one, and
-- that is the half worth stating. Adding a parameter creates a *new* function
-- as far as Postgres is concerned, so both would exist — and PostgREST calls
-- by argument name, so a call naming the original eleven would match both and
-- be refused as ambiguous. Every reading would have failed, and it would have
-- failed as `not-set-up`, which is the one status that sounds like a
-- migration had not run.
--
-- The new parameter still carries a default, which is what makes the deploy
-- window harmless in the other direction: a server still running the previous
-- build names eleven arguments, and they resolve here.
drop function if exists store_instrument_reading(
  uuid, text, numeric, text, jsonb, jsonb, jsonb, numeric, jsonb, text,
  smallint
);

create or replace function store_instrument_reading(
  target_user uuid,
  target_isin text,
  new_charge numeric,
  new_currency text,
  new_country_weights jsonb,
  new_sector_weights jsonb,
  new_constituents jsonb,
  new_coverage numeric,
  new_sources jsonb,
  new_model text,
  new_version smallint,
  new_asset_kind text default null
)
returns instrument_readings
language plpgsql
security definer
set search_path = public
as $$
declare
  result instrument_readings;
begin
  if not acting_for(target_user) then
    raise exception 'store_instrument_reading: not permitted for that user';
  end if;

  insert into instrument_readings (
    user_id, isin, ongoing_charge, currency, country_weights, sector_weights,
    top_constituents, constituents_coverage, sources, sourced_at, model,
    version, asset_kind
  )
  values (
    target_user, target_isin, new_charge, new_currency,
    coalesce(new_country_weights, '{}'::jsonb),
    coalesce(new_sector_weights, '{}'::jsonb),
    coalesce(new_constituents, '[]'::jsonb),
    new_coverage, coalesce(new_sources, '[]'::jsonb),
    now(), new_model, coalesce(new_version, 1), new_asset_kind
  )
  on conflict (user_id, isin) do update
    set ongoing_charge = excluded.ongoing_charge,
        currency = excluded.currency,
        country_weights = excluded.country_weights,
        sector_weights = excluded.sector_weights,
        top_constituents = excluded.top_constituents,
        constituents_coverage = excluded.constituents_coverage,
        sources = excluded.sources,
        sourced_at = excluded.sourced_at,
        model = excluded.model,
        version = excluded.version,
        asset_kind = excluded.asset_kind
  returning * into result;

  update instrument_reading_tallies
     set pending_since = null,
         last_read_at = now()
   where user_id = target_user;

  return result;
end;
$$;

-- `025` sets out why this is not optional, and it is the half of this file
-- most easily skipped: Postgres grants EXECUTE on a new function to PUBLIC,
-- and `anon` is the role behind the key that ships in every browser and both
-- app bundles. `create or replace` would have carried the old signature's
-- grants over, but the twelve-argument form is a *new* function as far as
-- Postgres is concerned — it arrives with PUBLIC's default grant, and the
-- eleven-argument sibling that `032` locked down has just been dropped.
--
-- Running this file to the end therefore matters. Applied without these four
-- statements, `anon` can call the writer; `acting_for` still refuses it, so
-- nothing can actually be written, but that leaves one defence where `025`
-- deliberately put two. Its own words: either alone would do it, and neither
-- should be the only thing standing there.
--
-- `from public, anon` rather than from PUBLIC alone, matching `025` and
-- `032`. Revoking from PUBLIC is what does the work; naming `anon` too means
-- a PUBLIC grant reinstated by accident later does not quietly hand it back.
revoke execute on function store_instrument_reading(
  uuid, text, numeric, text, jsonb, jsonb, jsonb, numeric, jsonb, text,
  smallint, text
) from public, anon;

grant execute on function store_instrument_reading(
  uuid, text, numeric, text, jsonb, jsonb, jsonb, numeric, jsonb, text,
  smallint, text
) to authenticated, service_role;

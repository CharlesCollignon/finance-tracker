-- What migration 068 has to be true for: the tax boxes' table is gone.
--
--   psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/068_no_tax_boxes.test.sql

\set ON_ERROR_STOP on

do $$
begin
  if to_regclass('public.tax_box_categories') is not null then
    raise exception 'FAILED: the tax boxes'' table is gone';
  end if;
  raise notice '  ok  the tax boxes'' table is gone';
end;
$$;

\echo 068_no_tax_boxes: all assertions passed

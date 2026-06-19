-- Share-based recurring (ETF / stock DCA with live quotes)

create type pricing_type as enum ('fixed', 'shares');

alter table recurring_templates
  add column pricing_type pricing_type not null default 'fixed',
  add column share_count integer,
  add column instrument_symbol text,
  add column instrument_name text,
  add column last_quote_price numeric(12, 4),
  add column last_quote_at timestamptz;

alter table recurring_templates
  add constraint recurring_share_count_positive
  check (share_count is null or share_count > 0);

alter table recurring_templates
  add constraint recurring_shares_fields_check
  check (
    pricing_type = 'fixed'
    or (
      share_count is not null
      and instrument_symbol is not null
      and instrument_name is not null
    )
  );

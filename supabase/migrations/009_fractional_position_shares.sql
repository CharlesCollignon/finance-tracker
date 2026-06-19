-- Fractional total shares on investment positions (e.g. 1.1465)

alter table investment_positions
  drop constraint if exists investment_positions_share_count_check;

alter table investment_positions
  alter column share_count type numeric(12, 6)
  using share_count::numeric(12, 6);

alter table investment_positions
  add constraint investment_positions_share_count_positive
  check (share_count is null or share_count > 0);

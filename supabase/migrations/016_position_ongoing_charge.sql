-- What a holding costs to hold.
--
-- The ongoing charge (TER / frais courants) is the largest controllable cost
-- in a long-term portfolio and the only one nobody ever sees: it is taken
-- continuously out of the fund's value and never appears as a line on a
-- statement. Recording it lets the app put a euro figure on it.
--
-- Entered by hand rather than fetched. The figure changes about once a year
-- and sits on every fund's KID, while no free API covers European UCITS ETFs
-- reliably — so a subscription would be paying monthly for a number that does
-- not move. The column is shaped so an API could fill it later without any
-- further migration.
--
-- Stored as a fraction (0.0020 = 0.20%) to match how target_weight is stored
-- on wallet_plans. Five decimals resolves to a thousandth of a percent, which
-- covers the 0.065%-style charges some trackers quote.

alter table investment_positions
  add column ongoing_charge numeric(6, 5)
    check (
      ongoing_charge is null
      -- A fund charging more than 10% a year does not exist; anything above
      -- that is a percentage entered where a fraction was expected.
      or (ongoing_charge >= 0 and ongoing_charge <= 0.1)
    );

comment on column investment_positions.ongoing_charge is
  'Annual ongoing charge (TER/OCF) as a fraction: 0.0020 = 0.20% per year.';

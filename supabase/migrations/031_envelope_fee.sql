-- What the envelope costs, on top of what the funds inside it cost.
--
-- An assurance-vie charges an annual fee on the whole contract — typically
-- 0.5% to 0.8% — and it is levied in addition to each unit's own ongoing
-- charge. A portfolio held in an assurance-vie therefore costs more than the
-- sum of its funds' TERs, and reporting only the TER understates the drag by
-- roughly a factor of two. That gap is the single most useful thing a fee
-- analysis can tell someone, so the app has to know the envelope's share.
--
-- On wallet_plans rather than on each position: the fee is a property of the
-- contract, not of what is held inside it. Null means "no envelope fee",
-- which is the truth for a PEA, a CTO and crypto, so no row needs backfilling.
--
-- Shaped exactly like investment_positions.ongoing_charge — same numeric,
-- same fraction convention, same 10% ceiling catching a percentage typed
-- where a fraction belongs — so the two can be added together without either
-- caller having to remember which unit it is in.

alter table wallet_plans
  add column if not exists wrapper_fee numeric(6, 5)
    check (
      wrapper_fee is null
      or (wrapper_fee >= 0 and wrapper_fee <= 0.1)
    );

comment on column wallet_plans.wrapper_fee is
  'Annual envelope fee as a fraction: 0.0075 = 0.75% per year, charged on top of each position''s ongoing_charge. Null means the wrapper takes nothing.';

-- The instrument's own name, as the rest of the world writes it.
--
-- Positions are keyed by a Yahoo symbol today (`CW8.PA`, `BTC-EUR`), which is
-- one vendor's spelling of an instrument and says nothing about what the
-- instrument holds. An ISIN is the identifier every issuer, factsheet and
-- regulator agrees on, so it is what a reference sheet can be looked up by.
--
-- Nullable, because it is unknown for crypto and for anything already saved.
-- The search that fills the symbol already returns the ISIN and throws it
-- away, so this is mostly plumbing that already exists.
--
-- The shape is checked here rather than trusted: two letters, nine
-- alphanumerics, one check digit. The check digit itself is not verified —
-- that belongs in the validator, where a bad one can be explained to whoever
-- typed it, not in a constraint that can only refuse.

alter table investment_positions
  add column if not exists isin text
    check (isin is null or isin ~ '^[A-Z]{2}[A-Z0-9]{9}[0-9]$');

comment on column investment_positions.isin is
  'ISO 6166 identifier, e.g. IE00B4L5Y983. Null until known; crypto has none.';

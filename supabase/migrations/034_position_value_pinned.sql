-- Whether a typed valuation should override the market.
--
-- `current_value` has been carrying two different pieces of information at
-- once: a figure, and the decision to prefer that figure over a live quote.
-- With one column the app had to infer the second from the presence of the
-- first, and it inferred "always override" — so a value typed once off a
-- broker statement won permanently, which is the opposite of a portfolio that
-- follows the market.
--
-- It also made zero un-representable. `current_value = 0` meant "this holding
-- is worth nothing", while the person typing it meant "I have no override,
-- use the price" — an entirely reasonable reading of a field labelled
-- "usually leave empty", and one that silently zeroed the position.
--
-- So the decision gets its own column. `current_value` is a figure;
-- `value_pinned` is whether it wins.
--
-- Defaulting to false adopts live-first for every row that already exists,
-- which is the intent. Nothing is lost by doing so: a typed figure stays in
-- `current_value`, is still shown in the position sheet, and is still what
-- values the holding when no quote can be had — it simply stops silently
-- outranking the market.

alter table investment_positions
  add column if not exists value_pinned boolean not null default false;

comment on column investment_positions.value_pinned is
  'When true, current_value overrides the live quote. When false (the default), a live quote wins and current_value is only a fallback.';

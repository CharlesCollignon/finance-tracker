-- 086: a recurring entry whose amount varies.
--
-- A pay moves with hours worked, commission or the days in the month —
-- unemployment benefit is paid per day, so February's is about 7 % lower —
-- and an energy bill with the season. Matching a bank movement to an
-- occurrence allowed 5 % below the figure (`recurring-fulfilment.ts`), so
-- such a pay or bill was reported missing every month it came in lower.
--
-- With `amount_varies`, the figure is an estimate: a movement in the same
-- category on the right days is the occurrence from half the figure up (and,
-- for anything but a pay, up to one and a half times it). No bonus is set
-- apart from such a pay: above the figure is just the amount varying.
--
-- Reverse:
--   alter table public.recurring_templates drop column if exists amount_varies;

alter table public.recurring_templates
  add column if not exists amount_varies boolean not null default false;

-- Yearly recurrence for annual expenses (e.g. Taxe Foncière), amortized in budget

alter type recurrence_type add value if not exists 'yearly';

alter table recurring_templates
  add column month_of_year int check (month_of_year between 1 and 12);

alter table recurring_templates
  drop constraint if exists recurring_schedule_check;

-- Postgres allows adding an enum value inside a transaction but refuses to let
-- the same transaction use it, and a migration runs in one. The check compares
-- `recurrence::text` so it never names the new value as an enum literal; the
-- truth of every row is the same. (Projects that ran this file before carry
-- `recurrence = 'yearly'::recurrence_type`, which is equivalent.)
alter table recurring_templates
  add constraint recurring_schedule_check check (
    (
      recurrence::text = 'monthly'
      and day_of_month is not null
      and day_of_week is null
      and month_of_year is null
    )
    or (
      recurrence::text = 'weekly'
      and day_of_week is not null
      and month_of_year is null
    )
    or (
      recurrence::text = 'yearly'
      and month_of_year is not null
      and day_of_month is not null
      and day_of_week is null
    )
  );

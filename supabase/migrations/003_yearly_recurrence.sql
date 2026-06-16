-- Yearly recurrence for annual expenses (e.g. Taxe Foncière), amortized in budget

alter type recurrence_type add value if not exists 'yearly';

alter table recurring_templates
  add column month_of_year int check (month_of_year between 1 and 12);

alter table recurring_templates
  drop constraint if exists recurring_schedule_check;

alter table recurring_templates
  add constraint recurring_schedule_check check (
    (
      recurrence = 'monthly'
      and day_of_month is not null
      and day_of_week is null
      and month_of_year is null
    )
    or (
      recurrence = 'weekly'
      and day_of_week is not null
      and month_of_year is null
    )
    or (
      recurrence = 'yearly'
      and month_of_year is not null
      and day_of_month is not null
      and day_of_week is null
    )
  );

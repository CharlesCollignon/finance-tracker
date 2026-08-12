-- Optional schedule window for recurring templates (échéancier).
-- NULL starts_on / ends_on = open-ended (previous behavior).

alter table public.recurring_templates
  add column if not exists starts_on date null,
  add column if not exists ends_on date null;

alter table public.recurring_templates
  drop constraint if exists recurring_templates_schedule_check;

alter table public.recurring_templates
  add constraint recurring_templates_schedule_check
  check (
    starts_on is null
    or ends_on is null
    or starts_on <= ends_on
  );

-- Investment granularity: weekly recurrence + budget vs deployment tracking

create type recurrence_type as enum ('monthly', 'weekly');

alter table categories
  add column counts_toward_summary boolean not null default true;

alter table recurring_templates
  add column recurrence recurrence_type not null default 'monthly',
  add column day_of_week int check (day_of_week between 1 and 7);

alter table recurring_templates
  alter column day_of_month drop not null;

alter table recurring_templates
  add constraint recurring_schedule_check check (
    (
      recurrence = 'monthly'
      and day_of_month is not null
      and day_of_week is null
    )
    or (
      recurrence = 'weekly'
      and day_of_week is not null
    )
  );

drop index if exists transactions_recurring_month_uidx;

create unique index transactions_recurring_date_uidx
  on transactions (user_id, recurring_template_id, occurred_on)
  where recurring_template_id is not null;

-- Backfill investment categories for existing users
update categories
set
  name = 'CTO weekly DCA',
  counts_toward_summary = false
where type = 'investment' and name = 'Brokerage DCA';

update categories
set
  name = 'PEA monthly DCA',
  counts_toward_summary = false
where type = 'investment' and name = 'PEA';

insert into categories (user_id, name, type, icon, counts_toward_summary)
select distinct
  c.user_id,
  'Broker transfer',
  'investment'::category_type,
  'bank',
  true
from categories c
where not exists (
  select 1
  from categories existing
  where existing.user_id = c.user_id
    and existing.type = 'investment'
    and existing.name = 'Broker transfer'
);

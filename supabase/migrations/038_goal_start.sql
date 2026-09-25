-- 038: a savings goal counts from the day it starts.
--
-- Until now a goal's progress was the current month's savings alone, so a
-- goal filled for a month and emptied on the first. It becomes a running
-- total from a start date. Existing goals start on the day they were
-- created, read in Europe/Paris like every other date in the app; the user
-- can move it.
--
-- Reversible: `alter table savings_goals drop column starts_on;` restores the
-- previous shape, and nothing else refers to the column.

alter table savings_goals add column if not exists starts_on date;

update savings_goals
   set starts_on = (created_at at time zone 'Europe/Paris')::date
 where starts_on is null;

alter table savings_goals
  alter column starts_on set default ((now() at time zone 'Europe/Paris')::date),
  alter column starts_on set not null;

comment on column savings_goals.starts_on is
  'First day whose savings count towards the goal. Backfilled from created_at.';

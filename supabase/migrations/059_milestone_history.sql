-- 059: when each milestone was reached (docs/plans/EVERYDAY_PLAN.md, phase 5).
--
-- « Votre année » lists the milestones reached in the year, and nothing
-- recorded when: `milestone_seen` is only the highest one the Plan has
-- celebrated. Each tier passed after it now goes here with its day, as the
-- Plan celebrates it — `[{ "amount": 20000, "on": "2026-11-02" }, …]`. The
-- first celebration is a starting point, not news: the tiers below it were
-- passed some time before anyone was there to see.
--
-- Reversible:
--   alter table user_preferences drop column milestone_history;

alter table user_preferences
  add column if not exists milestone_history jsonb not null default '[]'::jsonb;

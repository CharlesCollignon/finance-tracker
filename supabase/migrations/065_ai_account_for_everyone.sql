-- 065: « L'IA de votre choix » for everyone (docs/plans/EVERYDAY_PLAN.md,
-- phase 7; the owner's call, 2026-10-09).
--
-- `ai.account` on by default. What it means changed in the apps with it: the
-- person's own connected AI account writes their reads and answers their
-- questions; without one, Pluclair's key does, with its allowances, as
-- before. Nobody loses the AI by this; anyone may now bring their own.
--
-- Run after 064. Reverse:
--
--   update public.feature_flags set enabled_by_default = false
--     where key = 'ai.account';

update public.feature_flags
set enabled_by_default = true
where key = 'ai.account';

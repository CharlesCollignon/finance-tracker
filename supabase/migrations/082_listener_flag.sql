-- 082: The bank apps' notifications, read on the phone
-- (`docs/plans/STATEMENTS_PLAN.md`, Phase 5; `REFERENCE_APP_PLAN.md`,
-- Phase 12). Nothing new to store: a notification's line is a statement
-- line with `source = 'notification'`, which migration 074 already allows.
-- One flag, off by default, for the screen that turns it on — until an
-- APK carrying the listener module has been seen to work on a device.
--
-- Reverse: delete from public.feature_flags where key = 'listener.android';

insert into public.feature_flags (key, description)
values (
  'listener.android',
  'Reads the bank apps'' notifications on the phone (Android), as provisional lines. Off until the listener is seen working on a device.'
)
on conflict (key) do nothing;

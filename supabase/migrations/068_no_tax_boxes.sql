-- 068: the tax return page is gone from both apps and the landing, and with
-- it the table that said which category fills which box.
--
-- 066 made the table; this takes it away, rows and all. A database that never
-- ran 066 has nothing to drop.
--
-- Run after 067. Reverse: run 066 again (the rows do not come back).

drop table if exists public.tax_box_categories;

-- 079: Splits and receipts (`docs/plans/REFERENCE_APP_PLAN.md`, Phase 6).
--
-- A transaction is one amount in one category. One supermarket receipt is
-- often two — the groceries and the bottle of wine — and until now the
-- second had to be typed as a row of its own, with nothing saying the two
-- were one payment. A split keeps one row a part, as every figure already
-- counts them, and marks the parts as one with `split_group`: the Journal
-- draws them as one payment in several parts, and « Réunir » puts them
-- back into one row.
--
-- A receipt is the picture or the PDF behind a row: a private file in the
-- `receipts` bucket, under the owner's folder — the person's id, or their
-- space's for a joint row — and its path on the row. Read, when the person
-- asks, by their own AI account; never by anything else.
--
-- Run after 078. Reverse:
--   drop policy receipts_delete_owner on storage.objects; (and the three others)
--   delete from storage.buckets where id = 'receipts';
--   alter table transactions drop column split_group, drop column receipt_path;

alter table public.transactions
  add column if not exists split_group uuid,
  add column if not exists receipt_path text
    check (receipt_path is null or char_length(receipt_path) between 1 and 200);

create index if not exists transactions_split_group
  on public.transactions (user_id, split_group)
  where split_group is not null;

-- The bucket: private, small, pictures and PDFs only.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'receipts',
  'receipts',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- A file lives under its owner's folder: `<owner id>/<transaction id>/<file>`.
-- The owner is the person, or a space they are in — as the row's is.
create or replace function public.receipt_folder_is_mine(object_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (storage.foldername(object_name))[1] = (select auth.uid())::text
    or (storage.foldername(object_name))[1] in (
      select s::text from public.my_spaces() as s
    );
$$;

revoke all on function public.receipt_folder_is_mine(text) from public, anon;
grant execute on function public.receipt_folder_is_mine(text) to authenticated;

drop policy if exists receipts_select_owner on storage.objects;
create policy receipts_select_owner on storage.objects
  for select to authenticated
  using (bucket_id = 'receipts' and public.receipt_folder_is_mine(name));

drop policy if exists receipts_insert_owner on storage.objects;
create policy receipts_insert_owner on storage.objects
  for insert to authenticated
  with check (bucket_id = 'receipts' and public.receipt_folder_is_mine(name));

drop policy if exists receipts_update_owner on storage.objects;
create policy receipts_update_owner on storage.objects
  for update to authenticated
  using (bucket_id = 'receipts' and public.receipt_folder_is_mine(name))
  with check (bucket_id = 'receipts' and public.receipt_folder_is_mine(name));

drop policy if exists receipts_delete_owner on storage.objects;
create policy receipts_delete_owner on storage.objects
  for delete to authenticated
  using (bucket_id = 'receipts' and public.receipt_folder_is_mine(name));

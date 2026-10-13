-- 073: Entraide — who wrote what, kept a year, as French law asks of a host.
--
-- A host must keep what identifies whoever created content it publishes —
-- the account, the connection's address, the operation and when — for a
-- year, and hand it over only to the authorities that ask for it lawfully
-- (the LCEN and decree no. 2021-1362 of 20 October 2021). One row per
-- question or answer written, edited or deleted, written by the web's
-- actions with the service role (`apps/web/lib/entraide-authorship.ts`).
--
-- No session reads it, not even its own author's, and no foreign key ties
-- it to the account: it must outlive an account deleted, for the year, and
-- is the one thing that does. « Les règles d'Entraide » and the privacy
-- policy say so. The nightly sweep (`sweep_entraide`) erases what is past
-- the year, and with it the reports and decisions settled more than a year
-- ago — keeping a decision while the message it hid stays hidden, or the
-- pseudonym it barred stays barred, since its author still reads it.
--
-- Run after 072. Reverse: drop function sweep_entraide; drop table
-- entraide_authorship.

create table if not exists public.entraide_authorship (
  id bigint generated always as identity primary key,
  target text not null check (target ~ '^(post|reply):[0-9]{1,18}$'),
  operation text not null check (operation in ('create', 'edit', 'delete')),
  user_id uuid not null,
  email text,
  ip inet,
  created_at timestamptz not null default now()
);

create index if not exists entraide_authorship_created
  on public.entraide_authorship (created_at);
create index if not exists entraide_authorship_target
  on public.entraide_authorship (target);

alter table public.entraide_authorship enable row level security;
revoke all on table public.entraide_authorship from anon, authenticated;

create or replace function public.sweep_entraide()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  gone integer := 0;
  more integer;
begin
  delete from public.entraide_authorship
  where created_at < now() - interval '1 year';
  get diagnostics more = row_count;
  gone := gone + more;

  delete from public.entraide_reports
  where resolved_at < now() - interval '1 year';
  get diagnostics more = row_count;
  gone := gone + more;

  delete from public.entraide_decisions d
  where d.created_at < now() - interval '1 year'
    and not (
      d.action = 'hide' and (
        (d.target like 'post:%' and exists (
          select 1 from public.entraide_posts p
          where p.id = split_part(d.target, ':', 2)::bigint
            and p.status = 'hidden'))
        or (d.target like 'reply:%' and exists (
          select 1 from public.entraide_replies r
          where r.id = split_part(d.target, ':', 2)::bigint
            and r.status = 'hidden'))
      )
    )
    and not (
      d.action = 'bar' and exists (
        select 1 from public.entraide_profiles pr
        where pr.user_id = d.author_id and pr.banned_at is not null
      )
    );
  get diagnostics more = row_count;
  return gone + more;
end;
$$;

revoke all on function public.sweep_entraide() from public, anon, authenticated;
grant execute on function public.sweep_entraide() to service_role;

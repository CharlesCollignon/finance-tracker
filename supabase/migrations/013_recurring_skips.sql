-- Skip a single recurring occurrence for a date (does not pause the template).

create table recurring_skips (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  template_id uuid not null references recurring_templates (id) on delete cascade,
  occurred_on date not null,
  created_at timestamptz not null default now(),
  unique (user_id, template_id, occurred_on)
);

create index recurring_skips_user_occurred_idx
  on recurring_skips (user_id, occurred_on desc);

alter table recurring_skips enable row level security;

create policy "recurring_skips_select_own"
  on recurring_skips for select using (auth.uid() = user_id);

create policy "recurring_skips_insert_own"
  on recurring_skips for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from recurring_templates t
      where t.id = template_id and t.user_id = auth.uid()
    )
  );

create policy "recurring_skips_delete_own"
  on recurring_skips for delete using (auth.uid() = user_id);

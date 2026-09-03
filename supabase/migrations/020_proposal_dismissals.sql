-- Standing charges the user has looked at and said no to.
--
-- The app reads a statement and offers what looks like a repeating charge.
-- Saying "not this" has to stick: without somewhere to record it, the same
-- suggestion returns on the next page load, and a suggestion that cannot be
-- refused is not a suggestion.
--
-- Keyed by the coarse merchant key the detector groups on, not by any row —
-- the point is to refuse the pattern, not one occurrence of it.

create table recurring_proposal_dismissals (
  user_id uuid not null references auth.users (id) on delete cascade,
  merchant_key text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, merchant_key)
);

alter table recurring_proposal_dismissals enable row level security;

create policy "recurring_proposal_dismissals_select_own"
  on recurring_proposal_dismissals for select using (auth.uid() = user_id);

create policy "recurring_proposal_dismissals_insert_own"
  on recurring_proposal_dismissals for insert with check (auth.uid() = user_id);

create policy "recurring_proposal_dismissals_delete_own"
  on recurring_proposal_dismissals for delete using (auth.uid() = user_id);

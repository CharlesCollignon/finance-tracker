-- The user's confirmation that a movement the bank reported is the occurrence
-- a template called for.
--
-- Two things describe the same rent: the template that says €780 leaves on
-- the 5th, and the bank row that says €780 left on the 4th. Nothing connected
-- them. `recurring_template_id` on a transaction means "a template wrote
-- this", and a bank row is written by the bank, so it is null — which left
-- every recurring charge the bank delivers counted twice: once as money that
-- moved, and once as money still forecast to move. On a salary that is a
-- whole month's income added to "yours to spend" that is not there.
--
-- The obvious fix is to set `recurring_template_id` on the bank row, and it
-- does not work. An occurrence is identified by template and *occurrence*
-- date, so a row dated the 4th standing in for an occurrence dated the 5th
-- still leaves the 5th forecast. The occurrence being fulfilled has to be
-- named, which is what this table does.
--
-- Deliberately not `recurring_skips`. A skip is the user saying an occurrence
-- should not exist; this is the user saying it already happened and here is
-- the proof. The two look alike to a projection and mean opposite things to
-- anyone reading the history.

create table recurring_fulfilments (
  user_id uuid not null references auth.users (id) on delete cascade,
  template_id uuid not null
    references recurring_templates (id) on delete cascade,

  -- The date of the occurrence being fulfilled, not the date the money moved.
  -- This is what makes the row cancel the right forecast.
  occurred_on date not null,

  -- The movement that fulfils it. `on delete cascade`, because a fulfilment
  -- whose evidence has been deleted is not a fulfilment: undoing a bank
  -- import must put the forecast back rather than leave the occurrence
  -- silently accounted for by nothing.
  transaction_id uuid not null
    references transactions (id) on delete cascade,

  confirmed_at timestamptz not null default now(),

  -- One fulfilment per occurrence. A second bank row that looks like the same
  -- rent is a duplicate to be reviewed, not a second fulfilment.
  primary key (user_id, template_id, occurred_on)
);

-- A transaction can only ever stand in for one occurrence. Without this, two
-- occurrences of the same template could both point at one bank row and both
-- stop being forecast — halving the month's expected outgoings on the
-- strength of a single payment.
create unique index recurring_fulfilments_transaction_idx
  on recurring_fulfilments (transaction_id);

-- Reading a month's fulfilments, which is how the projection excludes them.
create index recurring_fulfilments_user_date_idx
  on recurring_fulfilments (user_id, occurred_on);

alter table recurring_fulfilments enable row level security;

create policy "recurring_fulfilments_select_own"
  on recurring_fulfilments for select using (auth.uid() = user_id);

create policy "recurring_fulfilments_insert_own"
  on recurring_fulfilments for insert with check (auth.uid() = user_id);

create policy "recurring_fulfilments_update_own"
  on recurring_fulfilments for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "recurring_fulfilments_delete_own"
  on recurring_fulfilments for delete using (auth.uid() = user_id);

-- Occurrences the user has been offered and refused.
--
-- Without this the same wrong suggestion returns on every page load, and the
-- only way to be rid of it is to accept a match the user has already said is
-- not one. Keyed by occurrence rather than by transaction: "the 5th's rent is
-- not this payment" should not suppress the offer if a better candidate
-- arrives later, so the refusal names the pair.
create table recurring_fulfilment_refusals (
  user_id uuid not null references auth.users (id) on delete cascade,
  template_id uuid not null
    references recurring_templates (id) on delete cascade,
  occurred_on date not null,
  transaction_id uuid not null
    references transactions (id) on delete cascade,
  refused_at timestamptz not null default now(),
  primary key (user_id, template_id, occurred_on, transaction_id)
);

alter table recurring_fulfilment_refusals enable row level security;

create policy "recurring_fulfilment_refusals_select_own"
  on recurring_fulfilment_refusals for select using (auth.uid() = user_id);

create policy "recurring_fulfilment_refusals_insert_own"
  on recurring_fulfilment_refusals for insert with check (auth.uid() = user_id);

create policy "recurring_fulfilment_refusals_delete_own"
  on recurring_fulfilment_refusals for delete using (auth.uid() = user_id);

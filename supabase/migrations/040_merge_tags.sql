-- 040: merge one tag into another.
--
-- Rename and delete need nothing new: the tags policies (012) already let an
-- owner update and delete their own tags, and `transaction_tags` cascades
-- from `tags`. Merging does. Every transaction carrying the first tag has to
-- carry the second, the ones already carrying both must not collide, and the
-- first tag goes — in one transaction, or a failure halfway leaves
-- transactions tagged with neither.
--
-- ## Why security definer, where the design said invoker
--
-- The Phase 0 design named `security invoker`, relying on the existing
-- policies. Since 036 they cannot do it. `transaction_tags` is guarded only
-- through `transactions`, whose select policy now hides rows in the bin, so an
-- invoker can neither see nor move the tag links of a binned transaction —
-- while deleting the first tag would still cascade to them, the one path RLS
-- does not guard, and a restore would bring the transaction back untagged.
-- `transaction_tags` has no update policy either. So the function runs as its
-- owner and makes the checks itself, as 036's functions do: `acting_for` for
-- the caller, then both tags belonging to that user.
--
-- Reversible: `drop function merge_tags(uuid, uuid, uuid);`. Nothing else
-- refers to it, and a merge already made is ordinary data.
--
-- Every assertion this is meant to satisfy is in
-- `supabase/tests/040_merge_tags.test.sql`.

create or replace function merge_tags(
  target_user uuid,
  from_tag uuid,
  into_tag uuid
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  owned integer;
  moved integer;
begin
  if not acting_for(target_user) then
    raise exception 'merge_tags: not permitted for that user'
      using errcode = 'insufficient_privilege';
  end if;

  if from_tag is null or into_tag is null or from_tag = into_tag then
    raise exception 'merge_tags: a tag cannot be merged into itself'
      using errcode = 'invalid_parameter_value';
  end if;

  -- Both tags this user's, and held until the merge commits, so a rename or
  -- delete racing it waits rather than landing on a tag that is going.
  select count(*) into owned
    from (
      select 1
        from tags
       where id in (from_tag, into_tag) and user_id = target_user
         for update
    ) as locked;

  if owned <> 2 then
    raise exception 'merge_tags: both tags must belong to that user'
      using errcode = 'insufficient_privilege';
  end if;

  -- Every transaction the first tag is on, those in the bin included, gains
  -- the second. One already carrying both keeps its single link.
  insert into transaction_tags (transaction_id, tag_id)
  select transaction_id, into_tag
    from transaction_tags
   where tag_id = from_tag
  on conflict (transaction_id, tag_id) do nothing;

  get diagnostics moved = row_count;

  -- The cascade takes the first tag's remaining links with it.
  delete from tags where id = from_tag and user_id = target_user;

  return moved;
end;
$$;

comment on function merge_tags(uuid, uuid, uuid) is
  'Moves every transaction from from_tag to into_tag, then deletes from_tag. '
  'Returns how many transactions gained into_tag.';

/* ------------------------------------------------------------- the grants */

revoke execute on function merge_tags(uuid, uuid, uuid) from public, anon;
grant execute on function merge_tags(uuid, uuid, uuid) to authenticated, service_role;

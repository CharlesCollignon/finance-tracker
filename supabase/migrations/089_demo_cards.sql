-- 089: the demo account can't write to `cards` either.
--
-- 081 put the `refuse_demo_write` trigger on every public table that existed
-- then. 087 created `cards` afterwards without it, so a demo visitor could
-- answer a card's debit question and add a row. This adds the same trigger.
--
-- Safe to run before 087 (it does nothing when `cards` is missing) and more
-- than once. Run after 088.
-- Reverse: drop trigger if exists refuse_demo_write on public.cards;

do $$
begin
  if to_regclass('public.cards') is not null then
    drop trigger if exists refuse_demo_write on public.cards;
    create trigger refuse_demo_write
      before insert or update or delete on public.cards
      for each row execute function public.refuse_demo_write();
  end if;
end;
$$;

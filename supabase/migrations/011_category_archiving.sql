-- Categories can be archived: hidden from new-entry forms while keeping
-- historical transactions intact (delete is blocked by FK when in use).

alter table categories
  add column archived boolean not null default false;

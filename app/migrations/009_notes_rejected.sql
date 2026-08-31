-- Notes can be rejected without being destroyed.
--
-- The moderation screen needs three states, but `approved` only encodes
-- two. Adding `rejected` alongside rather than replacing `approved` with a
-- status column, because the public RLS policies are written against
-- `approved` ("public reads approved notes", "public can submit notes")
-- and rewriting them to add a feature would be a bigger, riskier change
-- than the feature deserves.
--
-- The three states, derived:
--   waiting   -> approved = false and rejected = false   (the queue)
--   published -> approved = true                          (live on the album)
--   rejected  -> rejected = true                          (hidden, recoverable)
--
-- A rejected note still has approved = false, so visitors can't see it --
-- the existing policy already covers that, no change needed.
--
-- Rejecting deliberately does NOT delete. Clicking the wrong button on
-- something a friend wrote should be undoable.

alter table notes
  add column if not exists rejected boolean default false;

-- Finding the waiting queue is the one query this screen runs constantly.
create index if not exists notes_pending_idx
  on notes (created_at desc)
  where approved = false and rejected = false;

select
  count(*) filter (where approved = false and rejected = false) as waiting,
  count(*) filter (where approved = true)                       as published,
  count(*) filter (where rejected = true)                       as rejected,
  count(*)                                                      as total
from notes;

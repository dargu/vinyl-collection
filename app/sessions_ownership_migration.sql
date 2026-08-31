-- ============================================================
-- SESSIONS FEATURE — OWNERSHIP + ATTENDEES + PLAY NOTES
--
-- Paste this whole file into the Supabase SQL Editor and hit Run.
-- Safe to run once. It's additive (new columns, one swapped index)
-- so it won't touch any of your existing 110 records or their tracks.
-- ============================================================


-- ------------------------------------------------------------
-- 1. RECORDS — who owns the physical copy.
--
-- Until now, `records` only ever held your own collection, so
-- ownership was implicit. Once we start logging sessions, a played
-- record might belong to a friend instead (Ysita brought "Acid").
-- That record still deserves a full row -- cover art, tracklist,
-- genre -- same as anything you own. It just isn't yours.
--
-- `owner` is plain text, not a constrained enum: the app's dropdown
-- offers Diego / Charlie / Ysita / Roy / Joul / Other, but the
-- database doesn't enforce that list. That mirrors how `location`
-- already works on sessions -- the UI is where the real guardrails
-- live, not a CHECK constraint that would need editing every time
-- someone new joins the group.
-- ------------------------------------------------------------
alter table records add column if not exists owner text default 'Diego';

-- Every existing row predates this column. They're all yours.
update records set owner = 'Diego' where owner is null;


-- ------------------------------------------------------------
-- 2. RECORDS — uniqueness, scoped per owner.
--
-- schema.sql originally wrote:
--     create unique index on records (discogs_release_id)
--       where discogs_release_id is not null;
-- That was correct when the table was only your shelf: the same
-- release could never legitimately appear twice. Now it can --
-- you and Charlie can each own a copy of the same Led Zeppelin
-- pressing. Those are two different physical objects (maybe even
-- two different conditions), so they need to be two different rows.
-- The constraint just needs to move from "unique release" to
-- "unique release per owner."
-- ------------------------------------------------------------
-- Find and drop the old index by its actual definition rather than a
-- guessed name (Postgres auto-names anonymous indexes, and guessing
-- wrong would silently leave the old constraint in place).
do $$
declare
  idx_name text;
begin
  select indexname into idx_name
  from pg_indexes
  where tablename = 'records'
    and indexdef ilike '%unique%'
    and indexdef ilike '%discogs_release_id%'
    and indexdef not ilike '%owner%';
  if idx_name is not null then
    execute format('drop index if exists %I', idx_name);
  end if;
end $$;

create unique index if not exists records_discogs_release_id_owner_idx
  on records (discogs_release_id, owner)
  where discogs_release_id is not null;


-- ------------------------------------------------------------
-- 3. SESSIONS — who showed up.
--
-- An array, same reasoning as `genres` on records: attendees have
-- no facts of their own (just a name), so a text[] column is enough
-- -- no need for a separate people table. Values come from the same
-- six-option list as `owner` (Diego/Charlie/Ysita/Roy/Joul/Other),
-- with "Other" allowing free text for guests outside the core group.
-- ------------------------------------------------------------
alter table sessions add column if not exists attendees text[] default '{}';


-- ------------------------------------------------------------
-- 4. PLAYS — per-play notes.
--
-- "Who brought it" is NOT a new column here -- that's just
-- `records.owner`, since we're keeping owner and brought-by always
-- in sync (no separate tracking for borrowed copies, at least for
-- now). What plays didn't have room for is a note specific to that
-- night's spin of that record ("side B skipped," "first time we'd
-- heard this one") -- distinct from `records.my_notes`, which is
-- about the record in general, not this particular session.
-- ------------------------------------------------------------
alter table plays add column if not exists notes text;


-- ============================================================
-- Nothing else changes. RLS policies already cover these tables
-- (public read, owner-only write) and apply automatically to the
-- new columns -- no new policies needed.
-- ============================================================

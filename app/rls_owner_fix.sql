-- ============================================================
-- TIGHTEN OWNER POLICIES TO ONE SPECIFIC ACCOUNT
--
-- schema.sql originally wrote:
--     create policy "owner writes records" on records
--       for all to authenticated using (true) with check (true);
--
-- Read carefully: that says "any signed-in user," not "Diego."
-- It was safe only because nobody besides you *could* sign in --
-- there was no real login screen yet. Now that we're adding a real
-- one, that assumption needs to become a rule, not a hope: if
-- Supabase's public sign-up is ever left open, a stranger creating
-- an account would get full write access. This file fixes that by
-- checking the specific logged-in user's id, not just "logged in."
--
-- APPLIED: this file is filled in and has been run. The UUID below is
-- Diego's Supabase Auth account, and it matches OWNER_USER_ID in
-- supabase-client.js -- the front end and the database have to agree on
-- who "the owner" is.
--
-- That UUID is deliberately committed rather than left as a placeholder.
-- It isn't a secret: it already ships to every visitor's browser inside
-- supabase-client.js. What protects the data is these policies plus the
-- account password, not the obscurity of the id. Leaving a placeholder
-- here would mean that rebuilding the database from these files produced
-- policies matching nobody -- discovered at the worst possible moment.
--
-- IF YOU EVER REBUILD FROM SCRATCH (new Supabase project):
--   1. Authentication -> Users -> Add user, with your email + password.
--      This is the ONLY account that should ever write anything.
--   2. Authentication -> Settings -> turn OFF "Allow new users to sign
--      up". The policies below already refuse writes from anyone else,
--      but there's no reason to let strangers create accounts at all.
--   3. The new project will issue a DIFFERENT user id. Replace the UUID
--      below, and OWNER_USER_ID in supabase-client.js, with that one.
--   4. Run this whole file in the SQL Editor.
-- ============================================================

drop policy if exists "owner writes records"  on records;
drop policy if exists "owner writes tracks"   on tracks;
drop policy if exists "owner writes sessions" on sessions;
drop policy if exists "owner writes plays"    on plays;
drop policy if exists "owner writes wishlist" on wishlist;
drop policy if exists "owner manages notes"   on notes;

create policy "owner writes records" on records
  for all to authenticated
  using (auth.uid() = '8c8e5aeb-af65-4fef-ae01-84ef12592237')
  with check (auth.uid() = '8c8e5aeb-af65-4fef-ae01-84ef12592237');

create policy "owner writes tracks" on tracks
  for all to authenticated
  using (auth.uid() = '8c8e5aeb-af65-4fef-ae01-84ef12592237')
  with check (auth.uid() = '8c8e5aeb-af65-4fef-ae01-84ef12592237');

create policy "owner writes sessions" on sessions
  for all to authenticated
  using (auth.uid() = '8c8e5aeb-af65-4fef-ae01-84ef12592237')
  with check (auth.uid() = '8c8e5aeb-af65-4fef-ae01-84ef12592237');

create policy "owner writes plays" on plays
  for all to authenticated
  using (auth.uid() = '8c8e5aeb-af65-4fef-ae01-84ef12592237')
  with check (auth.uid() = '8c8e5aeb-af65-4fef-ae01-84ef12592237');

create policy "owner writes wishlist" on wishlist
  for all to authenticated
  using (auth.uid() = '8c8e5aeb-af65-4fef-ae01-84ef12592237')
  with check (auth.uid() = '8c8e5aeb-af65-4fef-ae01-84ef12592237');

create policy "owner manages notes" on notes
  for all to authenticated
  using (auth.uid() = '8c8e5aeb-af65-4fef-ae01-84ef12592237')
  with check (auth.uid() = '8c8e5aeb-af65-4fef-ae01-84ef12592237');

-- The public-facing policies (anyone can read, anyone can submit an
-- unapproved note) are unaffected -- those were never the problem.

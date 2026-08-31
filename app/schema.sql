-- ============================================================
-- VINYL COLLECTION — DATABASE SCHEMA
--
-- Paste this whole file into the Supabase SQL Editor and hit Run.
-- It is safe to run once. Running it twice will error on the
-- "already exists" lines, which is fine and means it worked.
--
-- Read the comments. They explain WHY, not just WHAT.
-- ============================================================


-- ------------------------------------------------------------
-- 1. RECORDS — the core table. One row per record on your shelf.
-- ------------------------------------------------------------
create table records (
  -- Every table gets an "id". This is the row's permanent name.
  -- uuid = a long random string. We use it instead of 1, 2, 3 so
  -- that nobody can guess your record URLs by counting upward.
  id            uuid primary key default gen_random_uuid(),

  -- The plain facts. "text" means a string of any length.
  -- "not null" means the database will REFUSE to save a record
  -- without this. That is the database protecting you from
  -- your own future typos at 1am.
  artist        text not null,
  title         text not null,

  -- TWO years, not one. Your sheet only had the second kind.
  --   original_year = when the album came out. Kind of Blue: 1959.
  --   pressing_year = when YOUR copy was made. Yours: 2010.
  -- A collector cares about both, and they're different facts, so
  -- they're different columns. Merging them loses information you
  -- can never get back.
  original_year int,
  pressing_year int,

  label         text,

  -- Straight from your sheet. catalog_no is what's printed on the
  -- spine; discogs_release_id is how we re-fetch art and tracks
  -- later without matching on artist/title strings, which is
  -- fragile. Storing the id is what makes the import repeatable.
  catalog_no          text,
  discogs_release_id  bigint,

  -- format is a constrained vocabulary: only these values are
  -- allowed. If the app ever tries to save "lp " with a trailing
  -- space, the database rejects it. This is how you avoid ending
  -- up with LP, Lp, lp, and "L.P." three years from now.
  format        text check (format in ('LP', 'EP', 'Single', '12"', 'Box Set')),

  -- genres is an ARRAY of text — one column holding many values.
  --
  -- Note we did NOT make this its own table, even though it's a
  -- list. The rule from earlier was: a thing gets its own table
  -- if it can have many values AND has its own facts attached.
  -- A track has facts (number, length). A V&G session has facts
  -- (date, location). A genre is just a word. No facts of its
  -- own, nothing to store about it. So an array is enough.
  genres        text[] default '{}',

  -- Cover art is not stored IN the database. We store a link to
  -- the image file, which lives in Supabase Storage. Databases
  -- are bad at holding big binary blobs and good at holding text.
  cover_url     text,

  -- Condition. These were already their own columns in your
  -- sheet, so they stay their own columns here.
  media_condition   text,
  sleeve_condition  text,

  -- Your own writing. This is the "Notes" column from the sheet,
  -- imported exactly as it is: provenance, condition and pressing
  -- details all mixed together. You chose to keep it that way for
  -- now, which is fine — the raw text is preserved, so splitting
  -- it into real columns later is a one-time script, not a
  -- redesign. Nothing is lost by waiting.
  my_notes      text,

  -- The old "Featured @ Viniles & Galletas" checkbox from your
  -- sheet. It's here ONLY to carry forward the 10 records you'd
  -- already marked, because there are no dates to turn them into
  -- real sessions.
  --
  -- Going forward you won't set this by hand — you'll log actual
  -- sessions, and this stays as a record of what you knew before
  -- you started keeping dates.
  played_at_vg_legacy boolean default false,

  -- The two sections we generate once and then you edit.
  -- Stored as plain text, so they cost nothing to display.
  history       text,
  listening_notes text,

  -- Automatically stamped when the row is created. You never set
  -- this by hand.
  created_at    timestamptz default now()
);


-- ------------------------------------------------------------
-- 2. TRACKS — many per record.
-- ------------------------------------------------------------
create table tracks (
  id          uuid primary key default gen_random_uuid(),

  -- This is a FOREIGN KEY: it points at a row in "records".
  -- "on delete cascade" means if you delete a record, its tracks
  -- get deleted too, automatically. Without this you'd slowly
  -- accumulate orphaned tracks belonging to nothing.
  record_id   uuid not null references records(id) on delete cascade,

  -- Vinyl track positions aren't numbers -- "A1", "B2.1", "CD1-3".
  -- I originally typed this as int, thinking "track 1, 2, 3," and
  -- only real Discogs data caught the mistake. Text is correct.
  position    text not null,
  title       text not null,
  duration    text,              -- "4:32" — text, because we never do math on it

  -- No two tracks on the same record can share a position.
  unique (record_id, position)
);


-- ------------------------------------------------------------
-- 3. SESSIONS — one row per V&G night.
--
-- This table knows nothing about records. A session is just a
-- night that happened. That separation is the whole trick.
-- ------------------------------------------------------------
create table sessions (
  id            uuid primary key default gen_random_uuid(),
  session_date  date not null,
  location      text,
  notes         text,           -- "the night the power went out"
  created_at    timestamptz default now()
);


-- ------------------------------------------------------------
-- 4. PLAYS — the join table. This is the important one.
--
-- Each row means: "this record was played at that session."
-- It holds almost nothing, and it's what makes both of these
-- questions answerable:
--    "what did we play on March 3rd?"
--    "when has this record been to V&G?"
-- ------------------------------------------------------------
create table plays (
  id          uuid primary key default gen_random_uuid(),
  record_id   uuid not null references records(id) on delete cascade,
  session_id  uuid not null references sessions(id) on delete cascade,

  -- The same record can't be logged twice for one night.
  unique (record_id, session_id)
);


-- ------------------------------------------------------------
-- 5. NOTES — what your friends leave.
-- ------------------------------------------------------------
create table notes (
  id            uuid primary key default gen_random_uuid(),
  record_id     uuid not null references records(id) on delete cascade,
  author_name   text not null,
  body          text not null,

  -- You chose moderation: notes are invisible until you flip
  -- this to true. Default false means the safe state is the
  -- automatic one — you can never forget to moderate something.
  approved      boolean default false,

  created_at    timestamptz default now()
);


-- ------------------------------------------------------------
-- 6. WISHLIST — what you're hunting for.
--
-- Deliberately NOT a column on records. A wishlist item isn't a
-- record you own; it's a want. It has no cover art, no tracks,
-- no condition, and often no specific pressing in mind ("Arcade
-- Fire", no album). Forcing it into the records table would mean
-- every query about your collection has to remember to exclude
-- the things you don't actually have. Different thing, own table.
-- ------------------------------------------------------------
create table wishlist (
  id          uuid primary key default gen_random_uuid(),

  artist      text not null,
  title       text,            -- nullable: "Arcade Fire", album TBD
  notes       text,
  priority    int default 0,   -- for sorting; higher = want it more

  -- When you buy one, we create the real record and store its id
  -- here, then drop the item off the active list. That keeps the
  -- history of "this was on my list for two years" instead of
  -- silently deleting it.
  acquired_record_id uuid references records(id) on delete set null,
  acquired_at        timestamptz,

  created_at  timestamptz default now()
);


-- ============================================================
-- ROW LEVEL SECURITY (RLS)
--
-- This is the part that lets you have NO server code.
--
-- Normally you'd write a backend whose job is to decide who is
-- allowed to do what. Postgres can enforce those rules itself,
-- per row. So your web page talks to the database directly and
-- the database refuses anything it shouldn't allow — even if
-- someone opens the browser console and tries by hand.
--
-- Turning RLS on denies EVERYTHING by default. Then we hand
-- back exactly the permissions we want. Deny-by-default is the
-- right posture: a rule you forget to write fails closed.
-- ============================================================

alter table records  enable row level security;
alter table tracks   enable row level security;
alter table sessions enable row level security;
alter table plays    enable row level security;
alter table notes    enable row level security;
alter table wishlist enable row level security;


-- --- Anyone on the internet can READ your collection. ---
-- "anon" is the role for a visitor who isn't logged in.
create policy "public can read records"  on records  for select to anon, authenticated using (true);
create policy "public can read tracks"   on tracks   for select to anon, authenticated using (true);
create policy "public can read sessions" on sessions for select to anon, authenticated using (true);
create policy "public can read plays"    on plays    for select to anon, authenticated using (true);
create policy "public can read wishlist" on wishlist for select to anon, authenticated using (true);


-- --- Only you can change anything. ---
-- "authenticated" = signed in. Since you'll be the only account,
-- this effectively means you. If you ever add a second admin,
-- this is the line you'd tighten to a specific user id.
create policy "owner writes records"  on records  for all to authenticated using (true) with check (true);
create policy "owner writes tracks"   on tracks   for all to authenticated using (true) with check (true);
create policy "owner writes sessions" on sessions for all to authenticated using (true) with check (true);
create policy "owner writes plays"    on plays    for all to authenticated using (true) with check (true);
create policy "owner writes wishlist" on wishlist for all to authenticated using (true) with check (true);


-- --- Notes: the interesting case. ---

-- Visitors can only SEE notes you've approved. Unapproved ones
-- are invisible to everyone but you — not hidden by the web page,
-- genuinely not sent over the network.
create policy "public reads approved notes"
  on notes for select to anon, authenticated
  using (approved = true);

-- Visitors can WRITE a note, but "with check (approved = false)"
-- means they cannot sneak in a pre-approved one. They don't get
-- to set that column.
create policy "public can submit notes"
  on notes for insert to anon, authenticated
  with check (approved = false);

-- You can see and do everything with notes, including approve.
create policy "owner manages notes"
  on notes for all to authenticated
  using (true) with check (true);


-- ============================================================
-- INDEXES — makes lookups fast.
--
-- An index is like the index at the back of a book: without one,
-- finding every track for a record means reading every track in
-- the table. At your scale this genuinely does not matter yet.
-- It costs nothing to do it right now, so we do.
-- ============================================================

create index on tracks (record_id);
create index on notes  (record_id);
create index on plays  (record_id);
create index on plays  (session_id);
create index on records using gin (genres);   -- gin = the right index type for arrays

-- Stops you importing the same Discogs release twice by accident.
-- "where ... is not null" because one of your 110 (Monairem,
-- Moonscape) has no Discogs entry at all, and several future ones
-- won't either. A plain unique index would reject all but the
-- first of those.
create unique index on records (discogs_release_id) where discogs_release_id is not null;


-- ============================================================
-- TWO REAL ROWS FROM YOUR SHEET, TO PROVE IT WORKS.
-- Delete these before the full import — the importer will add
-- all 110 including these.
-- ============================================================

insert into records (
  artist, title, original_year, pressing_year, label, format,
  genres, catalog_no, discogs_release_id, my_notes, played_at_vg_legacy
)
values
  -- Sheet row 36. Sheet said "2010" — that's your pressing.
  -- The album is from 1959.
  ('Miles Davis', 'Kind of Blue', 1959, 2010, 'Columbia', 'LP',
   array['Jazz'], '88697680571', 2825456, null, false),

  -- Sheet row 23. Marked "Yes" under Featured @ V&G, so the
  -- legacy flag carries that forward.
  ('Keith Jarrett', 'The Köln Concert', 1975, 2010, 'ECM Records', 'LP',
   array['Jazz'], 'ECM 1064/65', 3979641, 'Live', true);

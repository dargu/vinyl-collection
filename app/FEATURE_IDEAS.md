# Feature ideas (v1.1+)

Things we're deliberately not building into v1, so the first real
launch stays scoped. Add to this list any time an idea comes up —
nothing here blocks shipping.

- **Loans feature.** The old prototype already has a "who borrowed
  this record, since when" view (`loans` array in the JSX). Not in
  the current schema. Worth adding a `loans` table later, same
  pattern as `plays` (record + person + since-date).

- **Barcode scan to add.** Owner-only: scan a barcode (phone camera), look it up on
  Discogs, then choose whether it goes into the collection or the wishlist before
  saving. Most of the groundwork now exists — `api/discogs.js` already proxies
  Discogs lookups, and the Add-a-record flow already handles "search → pick a
  pressing → review". The remaining pieces are a camera scanner (browser
  `getUserMedia` + a barcode library like `zxing`) and a `mode=barcode` branch
  in the API function (Discogs supports search by UPC). Note that pre-1980s
  pressings often have no barcode at all, so it complements the text/catno
  search rather than replacing it.

- **Bulk re-tagging.** Editing one record at a time now works (Aug 2026), and
  the one-off genre cleanup from the personal sheet is done, so the urgency
  is gone — but if re-tagging turns out to be a recurring habit rather than
  a one-off, a multi-select ("filter to genre = Rock, tick several, reassign
  in one go") would beat opening records individually.

- **Multi-genre records.** The schema stores `genres` as an array, but every
  write path now collapses it to a single value and the Collection groups by
  `genres[0]`. That mismatch is what let `["Latin","Salsa"]` display as
  "Latin" until it was caught. Either commit to one genre (and the array
  becomes vestigial), or teach the Collection filter to show a record under
  each of its tags. Right now it's neither, which is the kind of gap that
  keeps producing small surprises.

- **Ask Claude about a record (owner mode).** A chat box in the detail view for
  asking about the album in front of you — who else is on the session, where it
  sits in the artist's run, what to listen for on this pressing. The record's
  row is already loaded, so a question can carry real context (artist, album,
  label, both years, genre, tracklist) instead of just a title.

  Groundwork: `api/discogs.js` is the shape to copy — a Vercel function holding
  a key the browser can't have. An Anthropic key would sit beside
  `DISCOGS_TOKEN` in the same environment variables.

  The catch, worth knowing before starting rather than after: owner mode is a
  client-side check (`isOwnerSession` compares the signed-in user id against
  `OWNER_USER_ID`), and what actually protects the data is RLS on the database.
  An API function has neither. `/api/discogs` being wide open is harmless — it's
  read-only lookup and Discogs rate-limits it — but an LLM endpoint spends money
  on every call, so hiding the box from visitors is not a defense. The function
  itself has to verify the caller's Supabase JWT and check the user id before
  spending anything. That's the one piece this repo has never needed before.

  Open question: whether answers are ephemeral or worth keeping. "The Take" on
  the detail view is already where written context about a record lives, so a
  good answer might belong there rather than vanishing when the panel closes.

- **Personal rating.** A rating on each record — including ones owned by other
  people — and a way to filter the Collection by it.

  Where it goes: a `rating` column on `records` (migration 010) rather than a
  separate table, since there's only ever one person doing the rating. Pin the
  scale with a CHECK constraint, and mind the Formats lesson below — every
  place that offers a value has to agree with the constraint. The control
  belongs in the detail view, which is the one screen both paths already share:
  the Collection opens it for your own records, Sessions opens it for friends'.
  The filter is another `select` in `shelf.jsx`'s filter bar plus a clause in
  `filtered`, and "By rating" is a natural fifth option in the sort beside it —
  probably the more useful half of the feature.

  The tension worth settling first: the Collection page only ever shows
  `myRecords` (owner = Diego), and friends' records surface only through
  Sessions. So rating a friend's record would work, but no filter on the
  Collection would ever bring it back. Either the filter is understood as
  Collection-only and rating friends' records is just for the record, or
  rating across owners needs a view that spans them.

  Open questions: the scale (five stars, ten, half-steps), and whether unrated
  is distinct from the bottom of it. And whether visitors see the ratings — the
  Collection is public, so that's a decision about the site's tone as much as
  an RLS policy.

## Conventions

- **Formats** must match `records_format_check` exactly: LP, 2xLP, 3xLP, EP,
  Single, 12", Box Set. Four places have to agree — the constraint, the
  `pickFormat` function in `api/discogs.js`, `FORMATS` in `admin.jsx`, and any
  import script. They didn't once, and adding a double album failed.

- **Artist names.** Discogs' `artists_sort` passes through whatever styling
  Discogs chose, so new records occasionally arrive spelled differently from
  what's already stored ("Fela Kuti And Africa 70" vs "Fela Kuti, Africa 70").
  Fix by hand in the edit form rather than normalising in code — collaborations
  are too irregular for a rule ("&", "feat.", "with", "presents" all differ).
  House spellings settled so far: `Fela Kuti and Afrika 70`, `DARKSIDE`.

## Done (kept for context)

- **"Roll the dice".** ✅ Sep 2026. A button on the Collection page that opens a
  record at random, for when the problem isn't finding something but choosing.
  It draws from the whole shelf and ignores the search box and the genre,
  artist and label filters — which is why it sits in the page header rather
  than the filter bar, since anything inside that bar reads as part of the
  filtering. It picks from `myRecords`, so friends' records, which share the
  table but never appear on this page, can't come up. Visitors can roll too.

  The result is the normal detail view, so there's nothing new to learn.
  "Roll again" appears in the detail header only when the record arrived on a
  roll — re-rolling from a record you opened yourself isn't what the button
  means — and the pool excludes whatever is already open, so a re-roll always
  moves. No new CSS: it reuses `.btn` in the header and `.btn--xs .btn--ghost`
  in the detail, so it matches its neighbours in both places.

- **Discogs search results show album and artist.** ✅ Sep 2026. The pressing
  picker shared by Add-a-record and the wishlist listed only label, catalog
  number and year, so searching for an album came back looking like a list of
  record labels. The name was already being fetched: Discogs returns
  "Artist - Title" as one string, which `slimSearchResult` passed through as
  `display` and nothing ever rendered. Now split into `artist` and `title` in
  `api/discogs.js`, with each card led by album and artist and label plus
  catalog number demoted to one secondary line. Splitting on the first " - "
  keeps hyphenated names intact (Jay-Z); an artist whose own name contains
  " - " would still split wrong, but this is display text only — the release
  lookup stays the source of truth once a pressing is picked.

- **Notes moderation screen.** ✅ Aug 2026 (migration 009). An owner tab after
  Sessions, with a count of what's waiting. Three states: waiting, published,
  and rejected. Rejecting sets a flag rather than deleting, so a misclick on
  something a friend wrote is recoverable — the archive is collapsed behind a
  toggle and each note has Restore. `approved` was left alone so the public
  RLS policies needed no changes.

- **Wishlist via Discogs.** ✅ Aug 2026 (migration 007). Wishlist entries are
  added through the same Discogs search the collection uses, carry cover art
  and pressing detail, and open a read-only detail preview. "Mark bought"
  re-fetches the release and shows the full review screen before creating the
  record, so a promoted item is indistinguishable from a direct add. Bought
  items stay on the list marked ✓. The unused `priority` column was dropped.

- **Edit an existing record.** ✅ Aug 2026. Owner-only edit form in the detail
  view, covering artist, album, genre, format, label, catalog number, both
  years, owner, notes, plus History and Listening notes. Cover art, tracklist
  and the Discogs release id are deliberately not editable — they're fetched
  as a set from one pressing. `deleteRecord()` exists in supabase-client.js
  but has no UI yet.

- **Genre cleanup.** ✅ Aug 2026. Migrations 004 and 005 restored Diego's own
  genres from the personal sheet and collapsed the multi-genre arrays the
  Sessions import had left behind. "Afrobeat" became the 15th house genre.

- **Guest note form clears fully.** ✅ Aug 2026. The visitor's name used to
  persist in localStorage across albums so a returning friend wouldn't retype
  it. Wrong trade for this site: the laptop gets passed around at a session,
  and the next person found someone else's name pre-filled and could post
  under it. Both fields now clear after posting, and nothing is remembered.

- **Session albums picked from the collection.** ✅ Aug 2026. Adding a record
  played is now a search over existing records; anything new goes through the
  same Discogs flow the Collection uses. This closed the hole where a typo in
  free text silently created a duplicate record.

## Known bugs

- **Streaming links go to search results, not the actual album.** The
  Tidal / Spotify / Apple Music buttons link to a *search* for artist +
  album, not the specific record. Usually right, but live albums, deluxe
  editions and reissues often land on the wrong one.

  **Attempted Aug 2026 via Tidal's API, and parked.** What we learned, so
  the next attempt doesn't repeat it:

  - Registering an app at developer.tidal.com is self-serve and free, and
    the client-credentials token endpoint (`auth.tidal.com/v1/oauth2/token`)
    works fine — auth was never the problem.
  - The search path is `openapi.tidal.com/v2/searchResults/...` — **camelCase**.
    Lowercase `searchresults` 404s, despite appearing that way in docs.
  - Every query format returned `400 INVALID_RESOURCE_ID`: `%20`, `+`,
    hyphens, no spaces at all, double-encoding. A plain alphanumeric string
    fails too, so it is *not* an encoding problem.
  - Strong suspicion: catalogue endpoints require **Authorization Code PKCE**
    (a real user login), not client credentials. The published spec marks
    endpoints that way. If so, this needs a login redirect and token storage
    — a big build for one button.

  Untried alternative that needs no credentials at all: the **iTunes Search
  API** (`itunes.apple.com/search?term=...&entity=album`) is free, needs no
  signup, and returns a `collectionViewUrl`. Confirmed reachable — it serves
  JSON as `text/javascript`, so browsers download it rather than display it,
  which looks like a failure but isn't. That could give Apple links directly,
  and feeding one into **Odesli** (song.link) could yield Tidal and Spotify
  links from the same lookup.

  **Left in place:** `records.tidal_url` (migration 008) and the detail view
  already prefers it over a search link. Nothing populates it, so filling
  that column by any means makes the feature work with no UI change.

  Vercel still has `TIDAL_CLIENT_ID` / `TIDAL_CLIENT_SECRET` set — harmless,
  and worth keeping if this gets picked up again.

## Backlog (not yet scoped)

_(nothing here yet)_

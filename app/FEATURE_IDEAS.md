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

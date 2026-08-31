# Next session: edit a record + genre cleanup

Two pieces of work, in this order.

---

## Part 1 — One-time genre cleanup from the personal sheet

**Why:** the Discogs import overwrote Diego's own genre judgements with
Discogs' broad buckets. Bob Dylan's *Highway 61 Revisited* and alt-J's
*An Awesome Wave* both ended up as "Rock"; the sheet has them as "Folk"
and "Alternative/Indie" respectively. Amy Winehouse is "Jazz" in the
sheet, not "Pop". The sheet is the better source of truth.

**Source:** the personal collection sheet, tab gid=684964732
https://docs.google.com/spreadsheets/d/1yLEvGGIvoO_XVzzTLJbn4D8PQ30Y0PJ-DgDP1jhI2ms/edit?gid=684964732

**How to join:** the sheet has a `release_id` column that maps directly
to `records.discogs_release_id`. Clean join, no fuzzy artist/title
matching needed — the same approach that caused trouble during the
Sessions import. One row (#38, Monairem — *Moonscape*) has no release_id
and will need matching by artist + title.

**Approach:** generate `update records set genres = ARRAY['X'] where
discogs_release_id = N;` statements from the sheet, review, paste into
Supabase. Same paste-and-run pattern as the Sessions import.

### Two decisions needed before generating the SQL

1. **"Afrobeat"** appears in the sheet (both Fela Kuti records) but isn't
   one of the 14 house genres. Add it to the house list, or fold those
   into "Funk"?

2. **"Salsa/ Tropical"** in the sheet has a space after the slash;
   the house list uses "Salsa/Tropical". Normalise to the house
   spelling — worth confirming, since inconsistent spelling splits the
   Collection filter into two near-identical entries.

### Also worth checking while we're in there

The sheet has ~139 records with data; the database has 114 under owner
"Diego". Some of that gap is legitimate (e.g. *good kid, m.A.A.d city*
appears twice — the melted copy and the replacement), but it's worth
reconciling in case records were added to the sheet after the original
import and never made it onto the site. If so, they can be added via the
new Discogs flow rather than another bulk import.

---

## Part 2 — Edit an existing record (the actual feature)

Owner-only edit form, reachable from the record detail view. Same shape
as the Add-a-record review screen, but pre-filled and doing an update
instead of an insert — so much of `ReviewStep` in `admin.jsx` can be
reused rather than rebuilt.

Needs a new `updateRecord(id, fields)` in `supabase-client.js`. RLS
already permits owner updates, so no schema or policy changes.

Open question deferred from before: whether to also build multi-select
bulk re-tagging. Doing the cleanup above via SQL removes the urgent need
for it, so single-record editing is the right first step — but if
re-tagging turns out to be a recurring habit rather than a one-off, bulk
edit moves up the list.

Note: the schema stores `genres` as an array, so a record can carry
several tags; only the UI insists on one. Worth deciding whether the
edit form allows multiple genres, since that would unlock the multi-tag
filtering flagged in `supabase-client.js`.

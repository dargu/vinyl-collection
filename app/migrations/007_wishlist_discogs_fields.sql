-- Wishlist gains Discogs metadata.
--
-- Until now a wishlist row held only artist, title and a note, so the
-- public page had to draw generated sleeve art and "mark bought" threw
-- away everything you'd already looked up. These columns let a wishlist
-- entry carry the same identity as a record.
--
-- Deliberately NOT copying every field from `records`: the tracklist and
-- full metadata are re-fetched from Discogs at the moment you mark it
-- bought, so there's one source of truth and the data can't go stale
-- sitting on a want-list for two years. discogs_release_id is what makes
-- that re-fetch possible; the rest is just enough to render the row.
--
-- RUN THIS AFTER DEPLOYING THE CODE. The old wishlist query sorts by
-- `priority`, so dropping that column first would break the live page
-- until the deploy lands.

alter table wishlist
  add column if not exists discogs_release_id bigint,
  add column if not exists cover_url          text,
  add column if not exists label              text,
  add column if not exists catalog_no         text,
  add column if not exists pressing_year      int,
  add column if not exists format             text;

-- priority was in the original schema for a "want it badly" sort that no
-- screen ever used. Removing it rather than leaving a column that lies
-- about being meaningful.
alter table wishlist drop column if exists priority;

select column_name, data_type
from information_schema.columns
where table_name = 'wishlist'
order by ordinal_position;

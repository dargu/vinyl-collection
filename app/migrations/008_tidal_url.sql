-- Store the resolved Tidal album link on the record.
--
-- The streaming buttons in the detail view previously linked to a SEARCH
-- for "artist album" -- usually right, but live albums, reissues and
-- deluxe editions landed on the wrong record often enough to be annoying.
--
-- Resolved once and stored, rather than looked up on each page view:
-- Tidal's rate limits are tight (429s after a handful of quick requests),
-- and an album's page never changes, so there's nothing to re-check.
--
-- NULL means "not looked up yet" and the UI falls back to a search link,
-- so this degrades quietly rather than leaving dead buttons.

alter table records
  add column if not exists tidal_url text;

select
  count(*) filter (where tidal_url is not null) as resolved,
  count(*) filter (where tidal_url is null)     as not_yet,
  count(*)                                      as total
from records;

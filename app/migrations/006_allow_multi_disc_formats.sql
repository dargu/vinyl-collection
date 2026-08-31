-- Allow multi-disc formats.
--
-- The original vocabulary was LP / EP / Single / 12" / Box Set. That was
-- fine when records were typed in by hand, but Discogs reports disc counts,
-- and a double album is a distinction worth keeping -- "Songs In The Key Of
-- Life" is not the same object as a single LP.
--
-- Without this, adding any double album through the site fails with
-- records_format_check. Anything above 3 discs is treated as a Box Set,
-- which is how Discogs usually labels those anyway.

alter table records drop constraint if exists records_format_check;

alter table records add constraint records_format_check
  check (format in ('LP', '2xLP', '3xLP', 'EP', 'Single', '12"', 'Box Set'));

-- Sanity check: what formats are actually in use?
select format, count(*) from records group by format order by count(*) desc;

# Viniles & Galletas

Diego's vinyl collection, public and browsable, with a private owner mode
for adding records, logging listening sessions, and moderating friend notes.

Live at https://darguelles-viniles.vercel.app

## What this is

A static site -- plain HTML, CSS, and React loaded from a CDN (no build
step, no `npm install`). Data lives in Supabase (Postgres), reached
directly from the browser. What stops a stranger writing to it is Postgres
row-level security, not the web page -- see `app/rls_owner_fix.sql`.

The one exception to "static" is `api/`, which Vercel runs server-side.
It exists to hold the Discogs token, which can't ship to the browser.

### The website

- `index.html` -- entry point, and where the app's own state lives
- `supabase-client.js` -- the only file that talks to Supabase; every
  component calls functions from here
- `shelf.jsx`, `detail.jsx`, `admin.jsx`, `sessions.jsx`, `dashboard.jsx`,
  `cover-art.jsx`, `tweaks-panel.jsx` -- the UI, loaded as
  `<script type="text/babel">` and transpiled in the browser
- `styles.css` -- all styling
- `api/discogs.js` -- server-side proxy for Discogs lookups

### The database's history

- `app/schema.sql` -- the original tables and RLS policies
- `app/rls_owner_fix.sql` -- tightens writes to one specific account
- `app/sessions_ownership_migration.sql` -- record ownership, attendees, play notes
- `app/migrations/` -- everything since, numbered in the order it was run.
  `app/migrations/README.md` is the log of what's been applied.
- `app/import/` -- one-off scripts that loaded the collection and session
  history from Discogs. Kept as a record, not part of the running site.

`app/` is deliberately excluded from the deployment (`.vercelignore`) --
it's version history, not website.

See `app/FEATURE_IDEAS.md` for what's built, what isn't, and the
conventions worth not re-litigating.

## Running it locally

```
python3 -m http.server 8000
```

then open `http://localhost:8000/`. Opening the HTML file directly
(double-click) won't work -- browsers block a local file from loading
other local files, which is why a tiny server is needed even just to
look at it.

Note that `api/discogs.js` won't run under that server, so adding a
record needs the deployed site.

## Making a change and seeing it live

Work happens in the Google Drive folder; this repo is the deployable
copy. `app/sync_to_repo.sh` copies between them.

1. Edit the file (in the Drive folder).
2. If you edited any `.jsx`, `supabase-client.js`, or `styles.css`, bump
   its `?v=` number in `index.html` -- otherwise browsers keep serving a
   cached copy and you'll think your change didn't work.
3. Run `app/sync_to_repo.sh` to copy the changes into this repo.
4. `git add -A && git commit -m "describe the change"`
5. `git push`

Vercel redeploys automatically on every push to `main`.

If the change touches the database, run the migration in Supabase's SQL
editor too, and add a row to `app/migrations/README.md`. Order matters:
whether the SQL or the deploy goes first depends on the change, and each
migration file says which.

## Secrets

Nothing secret is in this repo. The Supabase publishable key and the
owner's user id are both in `supabase-client.js` on purpose -- they're
meant to be public, and RLS is what protects the data.

The Discogs token lives in Vercel's environment variables as
`DISCOGS_TOKEN`, read only by `api/discogs.js`. The import scripts in
`app/import/` expect it in the shell instead:

```
export DISCOGS_TOKEN="your-token-here"
```

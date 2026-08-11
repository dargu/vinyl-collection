# Viniles & Galletas

Diego's vinyl collection, public and browsable, with a private owner mode
for adding records and moderating friend notes.

## What this is

A static site -- plain HTML, CSS, and React loaded from a CDN (no build
step, no `npm install`). All data lives in Supabase (Postgres), reached
directly from the browser using the rules in `../app/schema.sql`.

- `index.html` -- entry point (renamed from "Vinyl Collection.html" so it
  loads automatically at the site's root URL)
- `supabase-client.js` -- the only file that talks to Supabase; every
  component calls functions from here
- `shelf.jsx`, `detail.jsx`, `admin.jsx`, `dashboard.jsx`, `cover-art.jsx`,
  `tweaks-panel.jsx` -- the UI, loaded as `<script type="text/babel">`
  and transpiled in the browser
- `styles.css` -- all styling

See `../app/FEATURE_IDEAS.md` for what's deliberately not built yet.

## Running it locally

```
python3 -m http.server 8000
```
then open `http://localhost:8000/`. Opening the
HTML file directly (double-click) won't work -- browsers block a local
file from loading other local files, which is why a tiny server is
needed even just to look at it.

## Making a change and seeing it live

1. Edit the file.
2. If you edited any `.jsx` file or `supabase-client.js`, bump its
   version number in the `<script src="...?v=1">` tag in
   `Vinyl Collection.html` -- otherwise browsers may keep serving a
   cached copy.
3. `git add -A && git commit -m "describe the change"`
4. `git push`

Vercel redeploys automatically on every push to `main`.

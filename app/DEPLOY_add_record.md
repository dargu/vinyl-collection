# Deploying the Add-a-record feature

Five steps, in order. Steps 1 and 2 are new-concept steps (rotating a
token, adding an environment variable) — everything after that is the
same sync-and-push routine as last time.

---

## Step 1 — Rotate the exposed Discogs token

`enrich-covers.py` and `enrich-covers.mjs` in the git repo both have a
Discogs token hardcoded as a fallback (`VwRwOQ...`). If the GitHub repo
is public, so is that token.

1. Go to https://www.discogs.com/settings/developers
2. Revoke the existing personal access token.
3. Generate a new one and copy it somewhere safe for the next step.

The old scripts still read `DISCOGS_TOKEN` from the environment first, so
they keep working if you export the new token in your shell before running
them. The hardcoded fallback is now dead either way.

---

## Step 2 — Add the token to Vercel as an environment variable

This is what keeps the token off the public internet: it lives in Vercel's
settings, gets injected into the serverless function at runtime, and never
appears in any file or in the browser.

1. Open your project in the Vercel dashboard.
2. Settings → Environment Variables.
3. Add:
   - **Name:** `DISCOGS_TOKEN`
   - **Value:** the new token from step 1
   - **Environments:** tick all three (Production, Preview, Development)
4. Save.

Environment variables only apply to *new* deployments, so this must happen
before step 4, not after.

---

## Step 3 — Sync the files into the repo

```
bash "/Users/diegoarguelles/Library/CloudStorage/GoogleDrive-diegoarguellesll@gmail.com/My Drive/03. Play/3.8 AI & Tech Experiments/Claude/Claude_Cowork/Project_Viniles/app/sync_to_repo.sh"
```

The script now also copies the new `api/` folder. You should see `synced api/`
in the output alongside the usual files.

---

## Step 4 — Commit and push

```
cd ~/vinyl-collection
git status
git add -A
git commit -m "Add record via Discogs search: serverless proxy, pressing picker, tracklist preview"
git push
```

`git status` should show `api/discogs.js` as a new file, plus modifications
to `admin.jsx`, `supabase-client.js`, `index.html`, and `styles.css`.

Vercel will pick up the push and deploy. This build is slightly different
from previous ones: Vercel will now detect the `api/` folder and deploy
`discogs.js` as a serverless function. You can confirm it in the Vercel
deployment log — look for a "Functions" section listing `api/discogs`.

---

## Step 5 — Test it

Sign in as owner, go to Add a record, and try all three input styles:

| Input | Expected |
|---|---|
| `bill evans sunday at the village vanguard` | Grid of pressings, expandable |
| `OJC-140` | Straight to review (or a short list) |
| a Discogs release URL | Straight to review, no picker |
| something nonsense | "Nothing found on Discogs…" + manual option |

On the review screen, check the cover appears, the tracklist is listed,
and the genre box suggests both Discogs styles and your 14 house genres.

Save one, then confirm it shows up in the Collection with its cover art.

### If searching returns "Couldn't reach Discogs"

Almost always the environment variable. Check that `DISCOGS_TOKEN` is set
in Vercel for the Production environment and that you deployed *after*
adding it — a redeploy is needed for it to take effect.

---

## A note on the API endpoint being public

`/api/discogs` has no authentication on it, so in principle anyone who
finds the URL could use it to run Discogs searches. It's read-only —
it can't touch the database or write anything — so the worst case is
someone consuming your Discogs rate limit (60 requests/minute). Fine for
now; if it ever becomes a nuisance, the fix is to require a valid Supabase
session token on the request.

#!/usr/bin/env bash
# Copies the deployable app files from the Drive project folder into the
# local git repo (~/vinyl-collection), which is what actually gets pushed
# to GitHub/Vercel. Run this any time Claude edits app files in Drive,
# right before you git add/commit/push.
set -e

SRC="/Users/diegoarguelles/Library/CloudStorage/GoogleDrive-diegoarguellesll@gmail.com/My Drive/03. Play/3.8 AI & Tech Experiments/Claude/Claude_Cowork/Project_Viniles/darguelles - Vinyl collection"
DEST="$HOME/vinyl-collection"

FILES=(
  ".vercelignore"
  "sessions.jsx"
  "supabase-client.js"
  "index.html"
  "styles.css"
  "admin.jsx"
  "cover-art.jsx"
  "dashboard.jsx"
  "detail.jsx"
  "shelf.jsx"
)

for f in "${FILES[@]}"; do
  if [ -f "$SRC/$f" ]; then
    cp "$SRC/$f" "$DEST/$f"
    echo "synced $f"
  fi
done

# Serverless functions live in api/ -- Vercel picks them up automatically
# from that folder name, so it has to keep its structure.
if [ -d "$SRC/api" ]; then
  mkdir -p "$DEST/api"
  cp "$SRC/api/"*.js "$DEST/api/" 2>/dev/null && echo "synced api/"
fi

# The app/ folder -- schema, migrations, import scripts, planning docs.
# Not part of the website: it's the record of how the database was built,
# and it belongs under the same version control as everything else.
# .vercelignore keeps it out of the deployment so it isn't served publicly.
APP_SRC="$(dirname "$SRC")/app"
if [ -d "$APP_SRC" ]; then
  rsync -a --delete \
    --exclude ".DS_Store" \
    "$APP_SRC/" "$DEST/app/"
  echo "synced app/ (schema, migrations, import scripts)"
fi

echo ""
echo "Done. Now cd into $DEST and run:"
echo "  git status"
echo "  git add -A && git commit -m \"...\" && git push"

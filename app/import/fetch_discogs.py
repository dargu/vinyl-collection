#!/usr/bin/env python3
"""
Pulls real data from Discogs for every record in collection_source.csv
that has a release_id, and writes out import_records.json — one clean
object per record, ready to turn into SQL.

Two calls per record:
  1. /releases/{id}   -> exact pressing: images, tracklist, this copy's year
  2. /masters/{id}    -> the master release -> original release year

Rate limit for an authenticated personal token is 60 requests/minute.
110 records x up to 2 calls = ~220 calls, so we sleep between them
rather than trying to be clever about it.
"""
import os
import csv, json, time, sys
import requests

TOKEN = os.environ.get("DISCOGS_TOKEN", "")
if not TOKEN:
    raise SystemExit(
        'Set DISCOGS_TOKEN first:  export DISCOGS_TOKEN="your-token-here"  '
        "(get one at https://www.discogs.com/settings/developers)"
    )
HEADERS = {
    "Authorization": f"Discogs token={TOKEN}",
    "User-Agent": "ViniloCollectionImporter/1.0 (personal project)",
}
BASE = "https://api.discogs.com"
SLEEP = 1.1  # ~55 req/min, safely under the 60/min cap

def get(url):
    for attempt in range(3):
        r = requests.get(url, headers=HEADERS, timeout=20)
        if r.status_code == 200:
            return r.json()
        if r.status_code == 429:
            time.sleep(5)
            continue
        if r.status_code == 404:
            return None
        r.raise_for_status()
    return None

def fetch_release(release_id):
    return get(f"{BASE}/releases/{release_id}")

def fetch_master(master_id):
    return get(f"{BASE}/masters/{master_id}")

def main():
    with open("collection_source.csv") as f:
        rows = list(csv.DictReader(f))

    out = []
    errors = []

    for i, row in enumerate(rows):
        rid = row["release_id"].strip()
        label = f"[{i+1}/{len(rows)}] {row['artist']} - {row['album']}"

        if not rid:
            print(f"{label}: no discogs release_id, importing sheet data only")
            out.append({
                "source_id": row["id"],
                "artist": row["artist"],
                "title": row["album"],
                "original_year": None,
                "pressing_year": int(row["released"]) if row["released"] and row["released"] != "0" else None,
                "label": row["label"],
                "catalog_no": row["catalog_no"],
                "discogs_release_id": None,
                "format": row["format"],
                "sheet_genre": row["genre"],
                "genres": [row["genre"]] if row["genre"] else [],
                "cover_url": None,
                "my_notes": row["notes"],
                "played_at_vg_legacy": row["featured_vg"].strip().lower() == "yes",
                "tracks": [],
            })
            continue

        print(f"{label}: fetching release {rid}...")
        rel = fetch_release(rid)
        time.sleep(SLEEP)

        if rel is None:
            print(f"  -> release {rid} not found on Discogs, falling back to sheet data")
            errors.append({"id": row["id"], "artist": row["artist"], "title": row["album"], "reason": "release-not-found"})
            out.append({
                "source_id": row["id"],
                "artist": row["artist"],
                "title": row["album"],
                "original_year": None,
                "pressing_year": int(row["released"]) if row["released"] and row["released"] != "0" else None,
                "label": row["label"],
                "catalog_no": row["catalog_no"],
                "discogs_release_id": int(rid),
                "format": row["format"],
                "sheet_genre": row["genre"],
                "genres": [row["genre"]] if row["genre"] else [],
                "cover_url": None,
                "my_notes": row["notes"],
                "played_at_vg_legacy": row["featured_vg"].strip().lower() == "yes",
                "tracks": [],
            })
            continue

        # Original year: prefer the master release's year (the album's
        # true debut), fall back to this pressing's own year.
        original_year = rel.get("year")
        master_id = rel.get("master_id")
        if master_id:
            master = fetch_master(master_id)
            time.sleep(SLEEP)
            if master and master.get("year"):
                original_year = master["year"]

        artists = rel.get("artists") or []
        artist_name = ", ".join(a["name"] for a in artists) if artists else row["artist"]
        # Discogs disambiguates same-named artists as "Name (2)" -- strip that.
        import re
        artist_name = re.sub(r"\s*\(\d+\)$", "", artist_name).strip()

        images = rel.get("images") or []
        cover_url = None
        for img in images:
            if img.get("type") == "primary":
                cover_url = img.get("resource_url") or img.get("uri")
                break
        if not cover_url and images:
            cover_url = images[0].get("resource_url") or images[0].get("uri")

        tracks = []
        for t in rel.get("tracklist") or []:
            if t.get("type_") and t.get("type_") != "track":
                continue  # skip headings/subtracks markers Discogs sometimes includes
            tracks.append({
                "position": t.get("position", ""),
                "title": t.get("title", ""),
                "duration": t.get("duration", "") or None,
            })

        genres = list(dict.fromkeys((rel.get("genres") or []) + (rel.get("styles") or [])))
        if not genres and row["genre"]:
            genres = [row["genre"]]

        labels = rel.get("labels") or []
        label_name = labels[0]["name"] if labels else row["label"]

        out.append({
            "source_id": row["id"],
            "artist": artist_name,
            "title": rel.get("title") or row["album"],
            "original_year": original_year,
            "pressing_year": rel.get("year"),
            "label": label_name,
            "catalog_no": row["catalog_no"],
            "discogs_release_id": int(rid),
            "format": row["format"],
            "sheet_genre": row["genre"],
            "genres": genres,
            "cover_url": cover_url,
            "my_notes": row["notes"],
            "played_at_vg_legacy": row["featured_vg"].strip().lower() == "yes",
            "tracks": tracks,
        })

    with open("import_records.json", "w") as f:
        json.dump(out, f, indent=2)

    with open("import_errors.json", "w") as f:
        json.dump(errors, f, indent=2)

    print(f"\nDone. {len(out)} records written to import_records.json")
    print(f"{len(errors)} lookup failures written to import_errors.json")
    print(f"{sum(1 for r in out if r['cover_url'])} records got cover art")
    print(f"{sum(1 for r in out if r['tracks'])} records got a tracklist")

if __name__ == "__main__":
    main()

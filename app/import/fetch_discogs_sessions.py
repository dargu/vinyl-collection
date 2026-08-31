#!/usr/bin/env python3
"""
Same pattern as fetch_discogs.py, but for the new records the Sessions
import os
import needs (friends' copies + a couple of Diego's own that weren't in the
original 110). These don't have Discogs release_ids up front -- we don't
know them -- so this searches by artist + title first, then pulls full
release + master data for the top hit, same as the original importer does
once it has an id.

Run this locally (needs real internet access -- the Cowork sandbox this
was built in can't reach api.discogs.com):

    pip install requests
    python3 fetch_discogs_sessions.py

Writes enriched_records.json (feeds build_sessions_sql.py) and
misses.json (anything that didn't get a confident Discogs match --
those rows still get created, just without cover art/tracklist, exactly
like the original import handled its own misses).
"""
import json, time, re
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


def get(url, params=None):
    for attempt in range(3):
        r = requests.get(url, headers=HEADERS, params=params, timeout=20)
        if r.status_code == 200:
            return r.json()
        if r.status_code == 429:
            time.sleep(5)
            continue
        if r.status_code == 404:
            return None
        r.raise_for_status()
    return None


def search(artist, title):
    q = f"{artist} {title}"
    data = get(f"{BASE}/database/search", params={"q": q, "type": "release", "format": "Vinyl"})
    time.sleep(SLEEP)
    if not data or not data.get("results"):
        data = get(f"{BASE}/database/search", params={"q": q, "type": "release"})
        time.sleep(SLEEP)
    if not data or not data.get("results"):
        return None
    return data["results"][0]


def fetch_release(release_id):
    d = get(f"{BASE}/releases/{release_id}")
    time.sleep(SLEEP)
    return d


def fetch_master(master_id):
    d = get(f"{BASE}/masters/{master_id}")
    time.sleep(SLEEP)
    return d


def blank(item, release_id=None):
    return {**item, "discogs_release_id": release_id, "cover_url": None, "genres": [],
            "label": None, "catalog_no": None, "original_year": None,
            "pressing_year": None, "format": "LP", "tracks": []}


def main():
    with open("sessions_new_records.json") as f:
        items = json.load(f)

    out = []
    misses = []

    for i, item in enumerate(items):
        label = f"[{i+1}/{len(items)}] {item['owner']}: {item['artist']} - {item['title']}"
        hit = search(item["artist"], item["title"])
        if not hit:
            print(f"{label}: NO MATCH")
            misses.append(item)
            out.append(blank(item))
            continue

        release_id = hit.get("id")
        print(f"{label}: matched release {release_id} -> {hit.get('title')}")
        rel = fetch_release(release_id)
        if not rel:
            misses.append(item)
            out.append(blank(item, release_id))
            continue

        original_year = rel.get("year")
        master_id = rel.get("master_id")
        if master_id:
            master = fetch_master(master_id)
            if master and master.get("year"):
                original_year = master["year"]

        artists = rel.get("artists") or []
        artist_name = ", ".join(a["name"] for a in artists) if artists else item["artist"]
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
                continue
            tracks.append({"position": t.get("position", ""), "title": t.get("title", ""),
                            "duration": t.get("duration") or None})

        genres = list(dict.fromkeys((rel.get("genres") or []) + (rel.get("styles") or [])))
        labels = rel.get("labels") or []
        label_name = labels[0]["name"] if labels else None
        catno = labels[0].get("catno") if labels else None

        fmts = rel.get("formats") or []
        fmt = "LP"
        if fmts:
            descs = " ".join(fmts[0].get("descriptions") or []).lower()
            if "box" in descs:
                fmt = "Box Set"
            elif '12"' in descs:
                fmt = '12"'
            elif "single" in descs or '7"' in descs:
                fmt = "Single"
            elif "ep" in descs:
                fmt = "EP"

        out.append({
            "owner": item["owner"],
            "artist": artist_name,
            "title": rel.get("title") or item["title"],
            "original_year": original_year,
            "pressing_year": rel.get("year"),
            "label": label_name,
            "catalog_no": catno,
            "discogs_release_id": release_id,
            "format": fmt,
            "genres": genres,
            "cover_url": cover_url,
            "tracks": tracks,
        })

    with open("enriched_records.json", "w") as f:
        json.dump(out, f, indent=2)
    with open("misses.json", "w") as f:
        json.dump(misses, f, indent=2)

    print(f"\nDone. {len(out)} records, {len(misses)} misses.")
    print(f"{sum(1 for r in out if r.get('cover_url'))} got cover art")
    print(f"{sum(1 for r in out if r.get('tracks'))} got a tracklist")


if __name__ == "__main__":
    main()

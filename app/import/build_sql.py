#!/usr/bin/env python3
"""
Turns import_records.json into a single SQL file that inserts all 110
records + their tracks into Supabase. Paste-and-run, same pattern as
schema.sql.

Idempotent-ish: it deletes the two sample rows first (Kind of Blue /
Koln Concert) so re-running doesn't duplicate them, since those two
are also present in the real import.
"""
import json

def esc(s):
    """Escape a string for a SQL literal. None -> NULL (unquoted)."""
    if s is None:
        return "NULL"
    return "'" + str(s).replace("'", "''") + "'"

def esc_arr(items):
    if not items:
        return "'{}'"
    inner = ",".join('"' + str(x).replace('"', '\\"').replace("'", "''") + '"' for x in items)
    return f"'{{{inner}}}'"

def main():
    with open("import_records.json") as f:
        records = json.load(f)

    lines = []
    lines.append("-- Auto-generated from your Discogs data. Paste into the Supabase SQL Editor and run.")
    lines.append("-- Replaces the two sample rows from schema.sql so nothing gets duplicated.")
    lines.append("")
    lines.append("delete from records where artist = 'Miles Davis' and title = 'Kind of Blue';")
    lines.append("delete from records where artist = 'Keith Jarrett' and title = 'The Köln Concert';")
    lines.append("")

    # We need each record's new id to insert its tracks, so we use a
    # temp mapping table: insert records first, capturing generated
    # ids via a CTE per row is awkward in plain SQL, so instead we
    # insert with an explicit uuid we generate here in Python and
    # reuse for the matching tracks insert.
    import uuid

    for r in records:
        rid = str(uuid.uuid4())
        genres = r["genres"] or []
        fmt = r["format"] if r["format"] in ("LP", "EP", "Single", '12"', "Box Set") else "LP"

        lines.append(
            "insert into records (id, artist, title, original_year, pressing_year, label, "
            "catalog_no, discogs_release_id, format, genres, cover_url, my_notes, played_at_vg_legacy) values ("
            f"{esc(rid)}, {esc(r['artist'])}, {esc(r['title'])}, "
            f"{r['original_year'] if r['original_year'] else 'NULL'}, "
            f"{r['pressing_year'] if r['pressing_year'] else 'NULL'}, "
            f"{esc(r['label'])}, {esc(r['catalog_no'])}, "
            f"{r['discogs_release_id'] if r['discogs_release_id'] else 'NULL'}, "
            f"{esc(fmt)}, {esc_arr(genres)}, {esc(r['cover_url'])}, {esc(r['my_notes']) if r['my_notes'] else 'NULL'}, "
            f"{'true' if r['played_at_vg_legacy'] else 'false'});"
        )

        for t in r["tracks"]:
            lines.append(
                "insert into tracks (record_id, position, title, duration) values ("
                f"{esc(rid)}, {esc(t['position'])}, {esc(t['title'])}, {esc(t['duration'])});"
            )

    with open("import.sql", "w") as f:
        f.write("\n".join(lines) + "\n")

    print(f"Wrote import.sql: {len(records)} records, "
          f"{sum(len(r['tracks']) for r in records)} tracks")

if __name__ == "__main__":
    main()

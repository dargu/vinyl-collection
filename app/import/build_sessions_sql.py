#!/usr/bin/env python3
"""
Turns enriched_records.json (from fetch_discogs_sessions.py) + the session
grouping worked out from the sheet into a single paste-and-run SQL file.
Same pattern as build_sql.py.

Run this AFTER fetch_discogs_sessions.py, and AFTER you've already run
../sessions_ownership_migration.sql in Supabase (this import depends on
records.owner, sessions.attendees, and plays.notes existing).

    python3 build_sessions_sql.py

Writes import_sessions.sql -- paste into the Supabase SQL Editor and run.
"""
import json, uuid

def esc(s):
    if s is None:
        return "NULL"
    return "'" + str(s).replace("'", "''") + "'"

def esc_arr(items):
    if not items:
        return "'{}'"
    inner = ",".join('"' + str(x).replace('"', '\\"').replace("'", "''") + '"' for x in items)
    return f"'{{{inner}}}'"

def esc_date(s):
    return "NULL" if s is None else f"'{s}'"

CORE = ["Diego", "Charlie", "Ysita", "Roy", "Joul"]

# Each session: (date, location, attendees, notes, plays)
# A play is either:
#   ("existing", artist, title, owner)  -- reuse a record already in the table
#   ("new", index)                      -- index into sessions_new_records.json / enriched_records.json
#   ("new", index, play_note)           -- same, with a play-specific note
#
# Dates/locations/attendees marked "fecha aproximada" or "confirmar" in the
# notes are best-effort reconstructions from a messy sheet -- fix them up
# in the app once session editing exists (or straight in Supabase for now).
SESSIONS = [
    ("2024-01-17", "Ysita's", CORE, None, [
        ("new", 0),
        ("new", 1),
    ]),
    ("2024-01-31", "Charlie's", CORE, None, [
        ("existing", "Stevie Wonder", "Songs In The Key Of Life", "Diego"),
        ("new", 2),
    ]),
    ("2024-03-05", "Joul's", CORE, None, [
        ("existing", "Arctic Monkeys", "Whatever People Say I Am, That's What I'm Not", "Diego"),
        ("new", 3, "Proto-Salsa"),
        ("new", 4),
    ]),
    ("2024-04-15", "Diego's", CORE, "fecha aproximada -- no estaba en la hoja", [
        ("new", 5),
        ("existing", "Gil Scott-Heron, Makaya McCraven", "We're New Again (A Reimagining By Makaya McCraven)", "Diego"),
    ]),
    ("2024-06-03", "Ysita's", CORE, "Coincidio que se llevaron 2 Led Zeppelins, ademas de ser discos que salieron back to back", [
        ("new", 6),
        ("new", 7),
    ]),
    ("2024-07-03", "Charlie's", CORE, None, [
        ("new", 12),
        ("existing", "Howlin' Wolf, Eric Clapton, Steve Winwood, Bill Wyman, Charlie Watts", "The London Howlin' Wolf Sessions", "Diego"),
    ]),
    ("2024-07-18", "Diego's", CORE, None, [
        ("new", 8),
        ("new", 9),
    ]),
    ("2024-07-31", "Diego's", CORE, "Sesion extra por la proxima ausencia de Diego en otras iteraciones. Razon: paternidad", [
        ("existing", "Jamiroquai", "LateNightTales", "Diego"),
    ]),
    ("2024-08-20", "Joul's", CORE, "fecha aproximada -- Solo se escucho ese disco y la sesion se complemento geeking-out con musica en Tidal", [
        ("new", 10),
    ]),
    ("2024-09-04", "Diego's", CORE, None, [
        ("new", 11),
        ("existing", "The Strokes", "Is This It", "Diego"),
    ]),
    ("2024-10-02", "Diego's", ["Diego", "Charlie", "Ysita", "Roy"], "Joul no fue", [
        ("new", 23),
    ]),
    ("2024-12-05", "Ysita's", CORE, "Noche de intercambio de discos", [
        ("new", 38),
        ("new", 39),
        ("new", 40),
        ("new", 41),
        ("existing", "Manu Chao", "...Próxima Estación... Esperanza", "Diego"),
    ]),
    ("2024-12-20", "Charlie's", ["Diego", "Charlie", "Ysita", "Roy"], "fecha aproximada -- Joul no fue", [
        ("new", 13),
        ("existing", "Vampire Weekend", "Modern Vampires Of The City", "Diego"),
    ]),
    ("2025-01-08", "Other -- Ninety Nine Records", CORE, "Primer fieldtrip, invitacion de Diego a Ninety Nine Records. Tematica: Afro Cuban Beat", [
        ("new", 14),
        ("new", 32),
        ("new", 33),
        ("new", 34),
        ("new", 35),
        ("new", 36),
        ("new", 37),
    ]),
    ("2025-02-05", "Joul's", CORE, None, [
        ("new", 15),
        ("new", 16),
    ]),
    ("2025-03-01", "Diego's", ["Diego", "Ysita", "Roy", "Joul"], "fecha aproximada -- Charlie no fue", [
        ("new", 17),
        ("existing", "Darkside", "Psychic", "Diego"),
    ]),
    ("2025-04-02", "Charlie's", ["Diego", "Charlie", "Roy", "Joul"], "Ysita no fue", [
        ("existing", "Interpol", "Antics", "Diego"),
        ("new", 18),
    ]),
    ("2025-05-07", "Roy's", ["Charlie", "Ysita", "Roy"], "Joul y Diego no fueron", [
        ("new", 19),
        ("new", 20),
    ]),
    ("2025-06-05", "Other -- Templo del HiFi", CORE, "en el Templo del HiFi -- confirmar ubicacion exacta", [
        ("new", 29),
        ("new", 30),
        ("new", 31),
    ]),
    ("2025-07-20", "Diego's", ["Diego", "Charlie", "Ysita", "Joul"], "fecha aproximada -- Roy no fue", [
        ("new", 21),
        ("new", 22),
    ]),
    ("2025-08-05", "Roy's", CORE, "fecha aproximada", [
        ("new", 23),
        ("new", 24),
    ]),
    ("2025-08-20", "Ysita's", ["Charlie", "Ysita", "Roy"], "fecha aproximada -- Sin Diego ni Joul", [
        ("new", 25),
        ("new", 26),
    ]),
    ("2025-10-01", "Diego's", ["Diego", "Charlie", "Ysita", "Roy"], "fecha aproximada -- Sin Joul, que no nos deja escuchar U2", [
        ("existing", "U2", "The Joshua Tree", "Diego"),
        ("existing", "Thom Yorke", "The Eraser", "Diego"),
    ]),
    ("2026-01-08", "Ysita's", ["Diego", "Charlie", "Ysita", "Roy"], "Sin Joul", [
        ("new", 27),
        ("new", 28),
    ]),
]

def main():
    with open("enriched_records.json") as f:
        new_records = json.load(f)

    lines = []
    lines.append("-- Auto-generated Sessions import. Run sessions_ownership_migration.sql FIRST.")
    lines.append("-- Paste into the Supabase SQL Editor and run once.")
    lines.append("")

    # 1. New records + tracks, keyed by their index in sessions_new_records.json
    record_ids = {}
    for i, r in enumerate(new_records):
        rid = str(uuid.uuid4())
        record_ids[i] = rid
        fmt = r["format"] if r["format"] in ("LP", "EP", "Single", '12"', "Box Set") else "LP"
        lines.append(
            "insert into records (id, artist, title, original_year, pressing_year, label, "
            "catalog_no, discogs_release_id, format, genres, cover_url, owner) values ("
            f"{esc(rid)}, {esc(r['artist'])}, {esc(r['title'])}, "
            f"{r['original_year'] if r['original_year'] else 'NULL'}, "
            f"{r['pressing_year'] if r['pressing_year'] else 'NULL'}, "
            f"{esc(r['label'])}, {esc(r['catalog_no'])}, "
            f"{r['discogs_release_id'] if r['discogs_release_id'] else 'NULL'}, "
            f"{esc(fmt)}, {esc_arr(r['genres'])}, {esc(r['cover_url'])}, {esc(r['owner'])});"
        )
        for t in r["tracks"]:
            lines.append(
                "insert into tracks (record_id, position, title, duration) values ("
                f"{esc(rid)}, {esc(t['position'])}, {esc(t['title'])}, {esc(t['duration'])});"
            )
    lines.append("")

    # 2. Sessions + plays
    for date, location, attendees, notes, plays in SESSIONS:
        sid = str(uuid.uuid4())
        lines.append(
            "insert into sessions (id, session_date, location, attendees, notes) values ("
            f"{esc(sid)}, {esc_date(date)}, {esc(location)}, {esc_arr(attendees)}, {esc(notes)});"
        )
        for play in plays:
            note = None
            if play[0] == "existing":
                _, artist, title, owner = play
                record_expr = (
                    f"(select id from records where artist = {esc(artist)} "
                    f"and title = {esc(title)} and owner = {esc(owner)} limit 1)"
                )
            else:
                idx = play[1]
                note = play[2] if len(play) > 2 else None
                record_expr = esc(record_ids[idx])
            lines.append(
                "insert into plays (record_id, session_id, notes) values ("
                f"{record_expr}, {esc(sid)}, {esc(note)});"
            )
        lines.append("")

    with open("import_sessions.sql", "w") as f:
        f.write("\n".join(lines) + "\n")

    print(f"Wrote import_sessions.sql: {len(new_records)} new records, {len(SESSIONS)} sessions, "
          f"{sum(len(p) for *_, p in SESSIONS)} plays")

if __name__ == "__main__":
    main()

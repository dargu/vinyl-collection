# Genre map taken from the personal collection sheet (tab gid=684964732).
# Key = release_id (matches records.discogs_release_id), value = Diego's genre.
# "Salsa/ Tropical" in the sheet is normalised to the house "Salsa/Tropical".
PAIRS = [
(29792263,"Electronic"),(3050226,"Pop"),(2835842,"Blues"),(4041377,"Alternative/Indie"),
(8236333,"Jazz"),(36610048,"Alternative/Indie"),(7579375,"Blues"),(6657017,"Reggae"),
(9150523,"Alternative/Indie"),(2940876,"Alternative/Indie"),(15857861,"Alternative/Indie"),
(20165404,"Salsa/Tropical"),(23575493,"Electronic"),(24455669,"Electronic"),(32586471,"Rock"),
(9299215,"Soundtrack"),(8950450,"Electronic"),(8655907,"Salsa/Tropical"),(14752006,"Hip Hop"),
(19277239,"Alternative/Indie"),(12186161,"Alternative/Indie"),(9190560,"Blues"),(3979641,"Jazz"),
(23398166,"Hip Hop"),(24295229,"Hip Hop"),(3975953,"Hip Hop"),(10776167,"Alternative/Indie"),
(2395827,"Alternative/Indie"),(5731386,"Alternative/Indie"),(14339446,"Rock"),(5743279,"Rock"),
(762954,"R&B/Soul"),(5077187,"Electronic"),(6266472,"Rock"),(33488300,"Pop"),(2825456,"Jazz"),
(24629744,"Jazz"),(10962185,"Blues"),(20771251,"Electronic"),(70285,"Funk"),
(1049858,"Alternative/Indie"),(12214436,"Rock"),(35505388,"Rock"),(13468772,"R&B/Soul"),
(23429402,"R&B/Soul"),(10095109,"R&B/Soul"),(30669100,"Rock"),(8851020,"Alternative/Indie"),
(10270350,"Alternative/Indie"),(34746321,"Alternative/Indie"),(9814889,"Alternative/Indie"),
(24027815,"Alternative/Indie"),(11147862,"R&B/Soul"),(10892412,"R&B/Soul"),(323708,"R&B/Soul"),
(29396857,"Rock"),(7091295,"Rock"),(14195392,"Hip Hop"),(16213475,"Rock"),(4881115,"Rock"),
(9981969,"Rock"),(11721142,"Electronic"),(29446156,"Alternative/Indie"),(6238189,"Rock"),
(25419349,"Alternative/Indie"),(7764708,"Folk"),(9404930,"Pop"),(9674692,"Classical"),
(6334650,"Blues"),(4793522,"Blues"),(10488255,"Rock"),(8541806,"Rock"),(25174057,"Blues"),
(25050289,"Folk"),(29200381,"Funk"),(16169179,"Classical"),(10559651,"Hip Hop"),
(24882914,"Hip Hop"),(15683147,"Classical"),(28989175,"Electronic"),(2383925,"Jazz"),
(15469494,"R&B/Soul"),(1312950,"Alternative/Indie"),(29578063,"Alternative/Indie"),
(24747581,"Folk"),(26226236,"Alternative/Indie"),(17535775,"Alternative/Indie"),
(14401718,"Alternative/Indie"),(6292831,"Rock"),(20857672,"Alternative/Indie"),
(22926317,"Alternative/Indie"),(29817418,"Alternative/Indie"),(4666796,"Alternative/Indie"),
(7240889,"Reggae"),(28034796,"Pop"),(3337799,"Jazz"),(12258791,"Folk"),(4453244,"Rock"),
(3738094,"Rock"),(5011619,"Reggae"),(25062901,"Jazz"),(32121774,"Alternative/Indie"),
(4970787,"Electronic"),(20362099,"Reggae"),(3668613,"R&B/Soul"),(17841076,"Classical"),
(14297380,"R&B/Soul"),(2979143,"Alternative/Indie"),(16544148,"Reggae"),(3555769,"Rock"),
(33265488,"Electronic"),(33675372,"Alternative/Indie"),(33676011,"Salsa/Tropical"),
(33646428,"Electronic"),(33673704,"R&B/Soul"),(33697767,"Jazz"),(6510365,"R&B/Soul"),
(9025167,"Blues"),(25341883,"Electronic"),(22972040,"Electronic"),(24961471,"Electronic"),
(23350427,"Alternative/Indie"),(7383499,"Jazz"),(31442732,"Blues"),(35786479,"Folk"),
(28862140,"Folk"),(31852928,"Alternative/Indie"),(19943617,"Salsa/Tropical"),(22720388,"Jazz"),
(1159835,"Jazz"),(19995013,"Afrobeat"),(6206132,"Afrobeat"),(37109694,"Folk"),
(36615520,"Alternative/Indie"),(25246954,"Electronic"),(32416620,"R&B/Soul"),
(28021260,"Rock"),(14145883,"Folk"),
]

def esc(s):
    return "'" + s.replace("'", "''") + "'"

out = []
out.append("-- Genre cleanup: restore Diego's own genres from the personal")
out.append("-- collection sheet, overwriting what the Discogs import guessed.")
out.append("-- Joined on discogs_release_id, scoped to owner = 'Diego'.")
out.append("-- Safe to re-run: it just sets the same values again.")
out.append("")
out.append("begin;")
out.append("")
for rid, genre in PAIRS:
    out.append(f"update records set genres = ARRAY[{esc(genre)}] "
               f"where discogs_release_id = {rid} and owner = 'Diego';")
out.append("")
out.append("-- One sheet row has no Discogs release id, so it matches on name.")
out.append("update records set genres = ARRAY['Alternative/Indie'] "
           "where artist = 'Monairem' and title = 'Moonscape' and owner = 'Diego';")
out.append("")
out.append("commit;")
out.append("")
out.append("-- Check afterwards: how the collection now breaks down by genre.")
out.append("select genres[1] as genre, count(*) from records where owner = 'Diego' "
           "group by genres[1] order by count(*) desc;")
out.append("")

with open("/tmp/gen/genre_cleanup.sql", "w") as f:
    f.write("\n".join(out) + "\n")

seen = {}
for rid, g in PAIRS:
    seen[rid] = g
print(f"{len(PAIRS)} sheet rows, {len(seen)} unique release ids")
if len(PAIRS) != len(seen):
    print("WARNING: duplicate release ids in the sheet")
from collections import Counter
for g, n in Counter(g for _, g in PAIRS).most_common():
    print(f"  {g:<20} {n}")

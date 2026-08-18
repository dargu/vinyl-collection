// api/discogs.js — the site's only server-side code.
//
// WHY THIS EXISTS: the browser can't call the Discogs API directly. Two
// reasons: (1) the token would have to ship inside public JS, where anyone
// could take it and burn the rate limit tied to Diego's account, and
// (2) Discogs doesn't reliably send CORS headers, so the browser would
// block the response anyway.
//
// So the browser calls OUR OWN /api/discogs instead, and this function --
// running on Vercel, not in the browser -- calls Discogs with the token.
// The token lives in a Vercel environment variable (DISCOGS_TOKEN) and
// never reaches the client.
//
// Everything here is read-only lookup. Nothing writes to the database;
// saving still goes browser -> Supabase, protected by RLS as before.

const DISCOGS = "https://api.discogs.com";

// Discogs requires a descriptive User-Agent or it returns 403.
const UA = "VinilesYGalletas/1.0 +https://github.com/dargu/vinyl-collection";

async function discogs(path, token) {
  const sep = path.includes("?") ? "&" : "?";
  const res = await fetch(`${DISCOGS}${path}${sep}token=${token}`, {
    headers: { "User-Agent": UA, Accept: "application/json" },
  });
  if (!res.ok) {
    const err = new Error(`Discogs responded ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

// Search results only need enough to tell pressings apart in the picker.
// The full metadata comes later, from the release lookup, once one is picked.
function slimSearchResult(r) {
  return {
    id: r.id,
    // Discogs returns "Artist - Title" as one string here; we split it for
    // display but never trust it as data -- the release lookup is the
    // source of truth for artist and title.
    display: r.title || "",
    label: Array.isArray(r.label) ? r.label[0] : r.label || "",
    catno: r.catno || "",
    year: r.year || null,
    format: Array.isArray(r.format) ? r.format.join(", ") : r.format || "",
    country: r.country || "",
    thumb: r.cover_image || r.thumb || "",
  };
}

// Must only ever return a value the database's records_format_check
// constraint accepts (see app/migrations/006_allow_multi_disc_formats.sql).
// Anything unrecognised falls back to LP rather than failing the insert.
const ALLOWED_FORMATS = ["LP", "2xLP", "3xLP", "EP", "Single", '12"', "Box Set"];

function pickFormat(formats) {
  if (!Array.isArray(formats) || !formats.length) return "LP";
  const f = formats[0];
  const name = f.name || "";
  const qty = parseInt(f.qty, 10);
  const descs = f.descriptions || [];
  if (name === "Vinyl") {
    // 4+ discs is a box set in all but name, and that's usually how
    // Discogs describes them anyway.
    if (qty >= 4) return "Box Set";
    if (qty === 3) return "3xLP";
    if (qty === 2) return "2xLP";
    if (descs.includes('7"')) return "Single";
    if (descs.includes("EP")) return "EP";
    if (descs.includes('12"')) return '12"';
    return "LP";
  }
  if (name === "Box Set") return "Box Set";
  return ALLOWED_FORMATS.includes(name) ? name : "LP";
}

// Discogs stores artist names in a few shapes, and naively stitching the
// `artists` array together produces things like
//   "Kiyoshi Yamaya = Kiyoshi Yamaya, Toshiko Yonekawa = Toshiko Yonekawa"
// The "X = Y" form is Discogs' notation for a name and its variation
// (common on Japanese and other non-Latin releases, where the canonical
// name is in the original script and Y is the romanisation).
//
// `artists_sort` is Discogs' own single-string display name and is already
// clean, so prefer it and only fall back to assembling the array.
function cleanArtistPart(name) {
  return (name || "")
    .replace(/\s\(\d+\)$/, "")   // Discogs' "(2)" disambiguators
    .split(" = ")[0]             // keep one side of "name = variation"
    .trim();
}

function artistName(artists, artistsSort) {
  if (artistsSort && artistsSort.trim()) return cleanArtistPart(artistsSort);
  if (!Array.isArray(artists) || !artists.length) return "";
  const parts = artists.map((a, i) => {
    const nm = cleanArtistPart(a.name);
    // `join` is the separator Discogs supplies ("&", "feat.") -- respecting
    // it keeps collaborations reading naturally.
    const join = a.join && i < artists.length - 1 ? ` ${a.join} ` : "";
    return nm + join;
  });
  // Drop repeats: some releases list the same artist several times with
  // different name variations, which would otherwise read as a list of
  // one person three times.
  const seen = new Set();
  const deduped = parts.filter((p) => {
    const k = p.replace(/[\s,&]+$/, "").toLowerCase();
    if (!k || seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  return deduped.join("").replace(/\s+,/g, ",").replace(/[\s,&]+$/, "").trim();
}

async function fullRelease(id, token) {
  const rel = await discogs(`/releases/${id}`, token);

  // The master release (when there is one) knows the ORIGINAL year, which
  // is usually what you want alongside the pressing year on the sleeve.
  let originalYear = rel.year || null;
  if (rel.master_id) {
    try {
      const master = await discogs(`/masters/${rel.master_id}`, token);
      if (master.year) originalYear = master.year;
    } catch (_) {
      // A missing master is not a failure -- fall back to the release year.
    }
  }

  const label = (rel.labels && rel.labels[0]) || {};

  return {
    discogs_release_id: rel.id,
    artist: artistName(rel.artists, rel.artists_sort),
    title: rel.title || "",
    label: label.name || "",
    catalog_no: label.catno || "",
    original_year: originalYear,
    pressing_year: rel.year || null,
    format: pickFormat(rel.formats),
    country: rel.country || "",
    // genres are broad ("Jazz"), styles are specific ("Hard Bop").
    // Both go to the client so the genre box can suggest either.
    genres: rel.genres || [],
    styles: rel.styles || [],
    cover_url: (rel.images && rel.images[0] && (rel.images[0].uri || rel.images[0].resource_url)) || "",
    tracks: (rel.tracklist || [])
      .filter((t) => t.type_ === "track" || !t.type_)
      .map((t) => ({
        position: t.position || "",
        title: t.title || "",
        duration: t.duration || "",
      })),
  };
}

export default async function handler(req, res) {
  const token = process.env.DISCOGS_TOKEN;
  if (!token) {
    return res.status(500).json({ error: "DISCOGS_TOKEN is not set on the server." });
  }

  const { mode, q, id } = req.query || {};

  try {
    if (mode === "release") {
      if (!id || !/^\d+$/.test(String(id))) {
        return res.status(400).json({ error: "A numeric release id is required." });
      }
      const data = await fullRelease(id, token);
      // Cache briefly at the edge: release data barely changes, and this
      // keeps repeat lookups off the Discogs rate limit.
      res.setHeader("Cache-Control", "public, max-age=0, s-maxage=86400");
      return res.status(200).json(data);
    }

    if (mode === "search" || mode === "catno") {
      const term = (q || "").trim();
      if (!term) return res.status(400).json({ error: "Nothing to search for." });

      const params = new URLSearchParams({ type: "release", per_page: "40" });
      if (mode === "catno") params.set("catno", term);
      else params.set("q", term);
      // Vinyl first -- this is a vinyl collection, not a CD one.
      params.set("format", "Vinyl");

      let data = await discogs(`/database/search?${params.toString()}`, token);

      // If a vinyl-only search comes back empty, retry without the format
      // filter rather than telling the user "no results" for something
      // Discogs simply has catalogued as another format.
      if (!data.results || !data.results.length) {
        params.delete("format");
        data = await discogs(`/database/search?${params.toString()}`, token);
      }

      res.setHeader("Cache-Control", "public, max-age=0, s-maxage=3600");
      return res.status(200).json({ results: (data.results || []).map(slimSearchResult) });
    }

    return res.status(400).json({ error: "Unknown mode." });
  } catch (e) {
    // 429 is Discogs' rate limit -- worth telling the user plainly so they
    // wait rather than assuming the feature is broken.
    if (e.status === 429) {
      return res.status(429).json({ error: "Discogs is rate-limiting us. Wait a minute and try again." });
    }
    if (e.status === 404) {
      return res.status(404).json({ error: "Discogs doesn't have that release." });
    }
    return res.status(502).json({ error: "Couldn't reach Discogs. Try again in a moment." });
  }
}

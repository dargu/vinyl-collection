// api/tidal.js — resolves an album to its real Tidal page.
//
// WHY: the detail view's streaming buttons used to link to a SEARCH for
// "artist album", which usually surfaced the right thing but not always --
// live albums, reissues and deluxe editions were regularly wrong. This
// finds the actual album and returns its permanent URL.
//
// Credentials live in Vercel (TIDAL_CLIENT_ID / TIDAL_CLIENT_SECRET) and
// never reach the browser, same arrangement as the Discogs token.
//
// The result is meant to be SAVED on the record (records.tidal_url), not
// fetched on every page view: Tidal's rate limits are tight -- 429s have
// been reported after only a handful of rapid requests -- so this should
// be called once per album, ever.

const TOKEN_URL = "https://auth.tidal.com/v1/oauth2/token";
const API = "https://openapi.tidal.com/v2";

// Cached across warm invocations of the same function instance. Tokens are
// good for a while, and re-minting one per lookup would double our request
// count against a rate limit we're already close to.
let cachedToken = null;
let cachedUntil = 0;

async function getToken(id, secret) {
  const now = Date.now();
  if (cachedToken && now < cachedUntil) return cachedToken;

  const basic = Buffer.from(`${id}:${secret}`).toString("base64");
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  if (!res.ok) {
    const err = new Error(`Tidal auth failed (${res.status})`);
    err.status = res.status;
    throw err;
  }
  const body = await res.json();
  cachedToken = body.access_token;
  // Expire a minute early so a token never dies mid-request.
  cachedUntil = now + Math.max(0, (body.expires_in || 3600) - 60) * 1000;
  return cachedToken;
}

// Tidal speaks JSON:API: the search response lists album IDs under
// relationships, and the album objects themselves arrive in `included`.
function firstAlbum(body) {
  const rel = body && body.data && body.data.relationships && body.data.relationships.albums;
  const ref = rel && Array.isArray(rel.data) ? rel.data[0] : null;
  if (!ref) return null;

  const full = (body.included || []).find((x) => x.type === "albums" && x.id === ref.id);
  const attrs = (full && full.attributes) || {};
  return {
    id: ref.id,
    title: attrs.title || "",
    // Tidal's own share links use this form and redirect to the app when
    // it's installed.
    url: `https://tidal.com/browse/album/${ref.id}`,
  };
}

export default async function handler(req, res) {
  const clientId = process.env.TIDAL_CLIENT_ID;
  const clientSecret = process.env.TIDAL_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return res.status(500).json({ error: "TIDAL_CLIENT_ID / TIDAL_CLIENT_SECRET are not set on the server." });
  }

  const { artist, album, country } = req.query || {};
  if (!artist || !album) {
    return res.status(400).json({ error: "artist and album are both required." });
  }
  // Catalogue availability is per-country, and a country with no rights to
  // a release simply won't return it.
  const countryCode = (country || process.env.TIDAL_COUNTRY || "US").toUpperCase();

  try {
    const token = await getToken(clientId, clientSecret);
    const query = `${artist} ${album}`.trim();
    const url = `${API}/searchresults/${encodeURIComponent(query)}?countryCode=${countryCode}&include=albums`;

    const r = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.api+json" },
    });

    if (r.status === 429) {
      return res.status(429).json({ error: "Tidal is rate-limiting us. Wait a bit and try again." });
    }
    if (r.status === 404) {
      return res.status(200).json({ found: false });
    }
    if (!r.ok) {
      return res.status(502).json({ error: `Tidal responded ${r.status}` });
    }

    const match = firstAlbum(await r.json());
    if (!match) return res.status(200).json({ found: false });

    // Album pages don't change, so let the edge hold this for a long time.
    res.setHeader("Cache-Control", "public, max-age=0, s-maxage=604800");
    return res.status(200).json({ found: true, ...match });
  } catch (e) {
    if (e.status === 401 || e.status === 403) {
      return res.status(500).json({ error: "Tidal rejected the credentials — check the client ID and secret in Vercel." });
    }
    return res.status(502).json({ error: "Couldn't reach Tidal. Try again in a moment." });
  }
}

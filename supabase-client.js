// supabase-client.js — the ONLY file that talks to Supabase directly.
// Every other file calls functions from here; nobody else touches `sb`.
//
// SUPABASE_URL and SUPABASE_KEY below are safe to be public — they're
// meant to sit in browser code. Real protection comes from the Row
// Level Security rules in schema.sql, not from hiding these values.

const SUPABASE_URL = "https://yyydznvisypxrzuezfek.supabase.co";
const SUPABASE_KEY = "sb_publishable_5HiOdwKoBl9SD_AxtxcziQ_nf4xc1IS";

// OWNER_USER_ID: the one Supabase Auth user allowed to write. Set this
// after you create your account (Authentication -> Users in Supabase).
// Until it's filled in, sign-in will work but writes will be rejected
// by the database itself (see rls_owner_fix.sql) -- fail-safe, not
// fail-open.
const OWNER_USER_ID = "REPLACE_WITH_YOUR_SUPABASE_USER_ID";

const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ---------- shape mapping ----------
// The existing UI (shelf.jsx, detail.jsx, admin.jsx) expects a specific
// record shape from the old static data.js. Rather than rewrite every
// component, we map the real Supabase rows into that same shape here,
// once, in one place.
function mapRecordRow(row) {
  return {
    id: row.id, // uuid now, not a small int -- components treat it as an opaque key, which still works
    artist: row.artist,
    album: row.title,
    genre: (row.genres && row.genres[0]) || "Uncategorized", // shelf.jsx groups/filters by a single genre; see note below
    genres: row.genres || [],
    format: row.format,
    label: row.label,
    notes: row.my_notes || "",
    catalog_no: row.catalog_no,
    original_year: row.original_year,
    pressing_year: row.pressing_year,
    cover_url: row.cover_url,
    history: row.history,
    listening_notes: row.listening_notes,
    featuredVG: !!row.played_at_vg_legacy, // read-only now -- see FEATURE_IDEAS.md "Sessions tab"
    acquired: row.created_at ? row.created_at.slice(0, 7) : null,
    owner: row.owner || "Diego", // whose physical copy this is -- see sessions_ownership_migration.sql
    tracks: (row.tracks || []).slice().sort((a, b) => String(a.position).localeCompare(String(b.position), undefined, { numeric: true })),
  };
}
// NOTE on genre: records can carry several genre tags (schema.sql:
// `genres text[]`), but the current shelf/filter UI was built around
// one genre per record. Rather than rewrite the filter system now, we
// surface genres[0] as "the" genre for grouping and show the full
// list on the detail page. True multi-tag filtering is a clean v1.1
// addition -- the data already supports it.

// ---------- reads ----------

// Returns records from EVERY owner, not just Diego's -- Sessions needs to
// look up and reuse friends' records too (see sessions_ownership_migration.sql
// for why `owner` exists). The Collection/Wishlist pages filter this down
// to owner === "Diego" themselves; Sessions uses the full list as-is.
async function fetchCollection() {
  const { data, error } = await sb
    .from("records")
    .select("*, tracks(*)")
    .order("artist", { ascending: true });
  if (error) throw error;
  return data.map(mapRecordRow);
}

async function fetchWishlist() {
  const { data, error } = await sb
    .from("wishlist")
    .select("*")
    .order("priority", { ascending: false })
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data.map((w) => ({
    id: w.id,
    artist: w.artist,
    album: w.title || "",
    note: w.notes || "",
    bought: !!w.acquired_record_id,
    boughtOn: w.acquired_at ? w.acquired_at.slice(0, 10) : null,
  }));
}

async function fetchApprovedNotes(recordId) {
  const { data, error } = await sb
    .from("notes")
    .select("*")
    .eq("record_id", recordId)
    .eq("approved", true)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data.map((n) => ({ who: n.author_name, when: n.created_at.slice(0, 10), text: n.body }));
}

// Sessions + plays. A session knows nothing about records directly --
// `plays` is the join table (see schema.sql). We fetch the session rows
// with their play rows nested, then flatten to a plain list per session.
// "Who brought it" is NOT stored on the play -- it's just the record's
// `owner` (see sessions_ownership_migration.sql) -- so the UI looks each
// play's record up against the already-loaded `records` array (from
// fetchCollection, which includes every owner) rather than us re-shipping
// full record data here too.
async function fetchSessions() {
  const { data, error } = await sb
    .from("sessions")
    .select("*, plays(id, record_id, notes)")
    .order("session_date", { ascending: false });
  if (error) throw error;
  return data.map((s) => ({
    id: s.id,
    date: s.session_date,
    location: s.location || "",
    attendees: s.attendees || [],
    notes: s.notes || "",
    plays: (s.plays || []).map((p) => ({ playId: p.id, recordId: p.record_id, notes: p.notes || "" })),
  }));
}

// ---------- writes (all require an authenticated session; RLS enforces this) ----------

async function insertRecord({ artist, album, genre, format, label, notes, owner }) {
  const { data, error } = await sb
    .from("records")
    .insert({
      artist,
      title: album,
      genres: genre ? [genre] : [],
      format: format || "LP",
      label,
      my_notes: notes || null,
      owner: owner || "Diego",
    })
    .select("*, tracks(*)")
    .single();
  if (error) throw error;
  return mapRecordRow(data);
}

// Full-metadata insert, used by the Discogs-backed "Add a record" flow.
// insertRecord() above still exists for the quick/manual path and for
// promoting a wishlist item -- this one additionally saves cover art,
// years, catalog number, the Discogs id, and the tracklist.
//
// Tracks go in as a second insert rather than a nested one: PostgREST
// can't insert into two tables in a single call, and we need the new
// record's id first. If the tracks insert fails we keep the record --
// a record with no tracklist is still useful, and re-running the
// enrichment later can fill them in.
async function insertRecordFull(rec) {
  const { data, error } = await sb
    .from("records")
    .insert({
      artist: rec.artist,
      title: rec.album,
      genres: rec.genres && rec.genres.length ? rec.genres : (rec.genre ? [rec.genre] : []),
      format: rec.format || "LP",
      label: rec.label || null,
      catalog_no: rec.catalog_no || null,
      original_year: rec.original_year || null,
      pressing_year: rec.pressing_year || null,
      discogs_release_id: rec.discogs_release_id || null,
      cover_url: rec.cover_url || null,
      my_notes: rec.notes || null,
      owner: rec.owner || "Diego",
    })
    .select("*, tracks(*)")
    .single();
  if (error) throw error;

  if (rec.tracks && rec.tracks.length) {
    const rows = rec.tracks
      .filter((t) => t.title)
      .map((t) => ({
        record_id: data.id,
        position: t.position || null,
        title: t.title,
        duration: t.duration || null,
      }));
    if (rows.length) {
      const { error: trackErr } = await sb.from("tracks").insert(rows);
      if (!trackErr) data.tracks = rows;
    }
  }

  return mapRecordRow(data);
}

// Is this release already in the collection, for this owner? Checked
// before saving so you don't end up with two rows for the same copy.
// Scoped by owner deliberately -- two people CAN each own the same
// pressing (see sessions_ownership_migration.sql).
async function findByDiscogsId(releaseId, owner) {
  if (!releaseId) return null;
  const { data, error } = await sb
    .from("records")
    .select("id, artist, title, owner")
    .eq("discogs_release_id", releaseId)
    .eq("owner", owner || "Diego")
    .maybeSingle();
  if (error) return null;
  return data;
}

// ---------- Discogs lookup (via our own /api/discogs, never direct) ----------
// The token is server-side only; see api/discogs.js for why.

async function discogsCall(params) {
  const res = await fetch(`/api/discogs?${new URLSearchParams(params).toString()}`);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || "Discogs lookup failed.");
  return body;
}

async function discogsSearch(query) {
  const { results } = await discogsCall({ mode: "search", q: query });
  return results || [];
}

async function discogsSearchCatno(catno) {
  const { results } = await discogsCall({ mode: "catno", q: catno });
  return results || [];
}

async function discogsRelease(id) {
  return discogsCall({ mode: "release", id: String(id) });
}

async function insertWishlistItem({ artist, album, note }) {
  const { data, error } = await sb
    .from("wishlist")
    .insert({ artist, title: album || null, notes: note || null })
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function removeWishlistItem(id) {
  const { error } = await sb.from("wishlist").delete().eq("id", id);
  if (error) throw error;
}

async function markWishlistBought(wishItem, fields) {
  // 1. create the real record
  const newRecord = await insertRecord({
    artist: wishItem.artist,
    album: wishItem.album,
    genre: fields.genre,
    format: fields.format,
    label: fields.label,
    notes: fields.notes,
  });
  // 2. point the wishlist row at it and stamp the date, rather than
  //    deleting it -- so "this was on my list for two years" survives.
  const { error } = await sb
    .from("wishlist")
    .update({ acquired_record_id: newRecord.id, acquired_at: new Date().toISOString() })
    .eq("id", wishItem.id);
  if (error) throw error;
  return newRecord;
}

async function insertNote(recordId, authorName, body) {
  const { error } = await sb
    .from("notes")
    .insert({ record_id: recordId, author_name: authorName, body, approved: false });
  if (error) throw error;
}

async function insertSession({ date, location, attendees, notes }) {
  const { data, error } = await sb
    .from("sessions")
    .insert({ session_date: date, location: location || null, attendees: attendees || [], notes: notes || null })
    .select()
    .single();
  if (error) throw error;
  return { id: data.id, date: data.session_date, location: data.location || "", attendees: data.attendees || [], notes: data.notes || "", plays: [] };
}

async function updateSession(id, { date, location, attendees, notes }) {
  const { error } = await sb
    .from("sessions")
    .update({ session_date: date, location: location || null, attendees: attendees || [], notes: notes || null })
    .eq("id", id);
  if (error) throw error;
}

async function deleteSession(id) {
  const { error } = await sb.from("sessions").delete().eq("id", id);
  if (error) throw error;
}

async function addPlay(sessionId, recordId, notes) {
  const { error } = await sb.from("plays").insert({ session_id: sessionId, record_id: recordId, notes: notes || null });
  if (error) throw error;
}

async function removePlay(playId) {
  const { error } = await sb.from("plays").delete().eq("id", playId);
  if (error) throw error;
}

// ---------- auth ----------

async function signIn(email, password) {
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data.session;
}

async function signOut() {
  await sb.auth.signOut();
}

async function getSession() {
  const { data } = await sb.auth.getSession();
  return data.session;
}

function isOwnerSession(session) {
  return !!session && session.user && session.user.id === OWNER_USER_ID;
}

window.VC = {
  fetchCollection,
  fetchWishlist,
  fetchApprovedNotes,
  fetchSessions,
  insertRecord,
  insertRecordFull,
  findByDiscogsId,
  discogsSearch,
  discogsSearchCatno,
  discogsRelease,
  insertWishlistItem,
  removeWishlistItem,
  markWishlistBought,
  insertNote,
  insertSession,
  updateSession,
  deleteSession,
  addPlay,
  removePlay,
  signIn,
  signOut,
  getSession,
  isOwnerSession,
  sb,
};

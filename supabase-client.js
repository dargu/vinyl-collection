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

// ---------- writes (all require an authenticated session; RLS enforces this) ----------

async function insertRecord({ artist, album, genre, format, label, notes }) {
  const { data, error } = await sb
    .from("records")
    .insert({
      artist,
      title: album,
      genres: genre ? [genre] : [],
      format: format || "LP",
      label,
      my_notes: notes || null,
    })
    .select("*, tracks(*)")
    .single();
  if (error) throw error;
  return mapRecordRow(data);
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
  insertRecord,
  insertWishlistItem,
  removeWishlistItem,
  markWishlistBought,
  insertNote,
  signIn,
  signOut,
  getSession,
  isOwnerSession,
  sb,
};

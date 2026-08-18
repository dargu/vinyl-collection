// admin.jsx — owner-only views: dashboard, add new, wishlist, loans

const { useState: useState_a } = React;

// ── Add a record ────────────────────────────────────────────────────────────
// Three-step flow: search -> pick the pressing -> check and save.
//
// The search box takes whatever you give it and works out what it is:
//   a Discogs URL or bare release id  -> straight to that exact release
//   something that looks like a catno -> catalog-number search
//   anything else                     -> artist/album text search
//
// All Discogs traffic goes through /api/discogs (see api/discogs.js) so
// the token stays server-side. Manual entry is always available as an
// escape hatch -- plenty of records simply aren't on Discogs.
//
// Barcode scanning is deliberately NOT here yet: it needs a camera
// library and mobile testing, and it slots into this same box later
// (see FEATURE_IDEAS.md).

// The house genre list -- Diego's own taxonomy, deliberately narrower and
// more opinionated than Discogs'. Kept in one place and shared by the add
// form, the edit form, and the wishlist.
const HOUSE_GENRES = [
  "Afrobeat","Alternative/Indie","Blues","Classical","Electronic","Folk","Funk",
  "Hip Hop","Jazz","Pop","R&B/Soul","Reggae","Rock","Salsa/Tropical","Soundtrack",
];
const OWNERS = ["Diego", "Charlie", "Ysita", "Roy", "Joul", "Other"];
const FORMATS = ["LP", "2xLP", "EP", "Single", '12"', "Box Set"];

// A Discogs release URL looks like /release/12345-Some-Title, and people
// also paste bare ids. Both should skip the picker entirely.
function parseReleaseId(s) {
  const url = s.match(/discogs\.com\/(?:[a-z]{2}\/)?release\/(\d+)/i);
  if (url) return url[1];
  if (/^\d{4,}$/.test(s.trim())) return s.trim();
  return null;
}

// Catalog numbers are things like OJC-140, CR00344, BEC5161607 -- short,
// no spaces in the middle, and containing digits. Deliberately a loose
// guess: if it's wrong we fall back to a normal search, which is harmless.
function looksLikeCatno(s) {
  const t = s.trim();
  return t.length <= 14 && /\d/.test(t) && !/\s{1,}\w+\s{1,}/.test(t);
}

function blankDraft() {
  return {
    artist: "", album: "", label: "", catalog_no: "", genre: "",
    original_year: "", pressing_year: "", format: "LP",
    owner: "Diego", notes: "", cover_url: "", discogs_release_id: null,
    tracks: [], styleSuggestions: [],
  };
}

function draftFromRelease(rel) {
  return {
    artist: rel.artist || "",
    album: rel.title || "",
    label: rel.label || "",
    catalog_no: rel.catalog_no || "",
    genre: (rel.genres && rel.genres[0]) || "",
    original_year: rel.original_year || "",
    pressing_year: rel.pressing_year || "",
    format: FORMATS.includes(rel.format) ? rel.format : "LP",
    owner: "Diego",
    notes: "",
    cover_url: rel.cover_url || "",
    discogs_release_id: rel.discogs_release_id || null,
    tracks: rel.tracks || [],
    // This release's own Discogs genres and styles, offered alongside the
    // house list so specific tags ("Hard Bop") are one click away without
    // locking the field down.
    styleSuggestions: [...(rel.genres || []), ...(rel.styles || [])],
  };
}

function SearchStep({ onResults, onRelease, onManual, busy, setBusy }) {
  const [q, setQ] = useState_a("");
  const [err, setErr] = useState_a("");

  async function run() {
    const term = q.trim();
    if (!term) { setErr("Type something to search for first."); return; }
    setBusy(true); setErr("");
    try {
      const relId = parseReleaseId(term);
      if (relId) {
        onRelease(await window.VC.discogsRelease(relId));
        return;
      }
      let results = [];
      if (looksLikeCatno(term)) results = await window.VC.discogsSearchCatno(term);
      if (!results.length) results = await window.VC.discogsSearch(term);
      if (!results.length) {
        setErr("Nothing found on Discogs. Try fewer words, or enter it manually.");
        return;
      }
      // A single hit needs no picker -- go straight to the review screen.
      if (results.length === 1) {
        onRelease(await window.VC.discogsRelease(results[0].id));
        return;
      }
      onResults(results, term);
    } catch (e) {
      setErr(e.message || "That lookup didn't work. Try again in a moment.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <p className="addrec__lede">Paste a Discogs link, type a catalog number, or search by artist and album.</p>
      <div className="addrec__searchrow">
        <input
          className="input"
          autoFocus
          placeholder="bill evans sunday at the village vanguard"
          value={q}
          onChange={(e) => { setQ(e.target.value); setErr(""); }}
          onKeyDown={(e) => { if (e.key === "Enter") run(); }}
        />
        <button className="btn btn--solid" onClick={run} disabled={busy}>
          {busy ? "Searching…" : "Search"}
        </button>
      </div>
      {err && <div className="addrec__err">{err}</div>}
      <div className="addrec__footrow">
        <span className="muted small">Not on Discogs?</span>
        <button className="btn btn--xs btn--ghost" onClick={onManual}>Enter manually</button>
      </div>
    </div>
  );
}

function PickStep({ results, term, onPick, onManual, onBack, busy, setBusy }) {
  const [expanded, setExpanded] = useState_a(false);
  const [err, setErr] = useState_a("");
  const shown = expanded ? results : results.slice(0, 6);

  async function choose(r) {
    setBusy(true); setErr("");
    try {
      onPick(await window.VC.discogsRelease(r.id));
    } catch (e) {
      setErr("Couldn't load that release. Try another, or enter it manually.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="addrec__pickhd">
        <div>
          <div className="addrec__picktitle">{results.length} pressing{results.length === 1 ? "" : "s"} found</div>
          <p className="addrec__lede">Pick the one that matches your copy — check the label and catalog number on the sleeve.</p>
        </div>
        <button className="btn btn--xs btn--ghost" onClick={onBack}>New search</button>
      </div>

      <div className="pressgrid">
        {shown.map((r) => (
          <button key={r.id} className="presscard" onClick={() => choose(r)} disabled={busy}>
            {r.thumb
              ? <img className="presscard__art" src={r.thumb} alt="" loading="lazy" />
              : <div className="presscard__art presscard__art--none" />}
            <div className="presscard__body">
              <div className="presscard__label">{r.label || "Unknown label"}</div>
              <div className="presscard__cat mono">{r.catno || "—"}</div>
              <div className="presscard__meta">
                {[r.year, r.format, r.country].filter(Boolean).join(" · ")}
              </div>
            </div>
          </button>
        ))}
      </div>

      {err && <div className="addrec__err">{err}</div>}

      <div className="addrec__footrow">
        {results.length > 6 && (
          <button className="btn btn--xs btn--ghost" onClick={() => setExpanded(!expanded)}>
            {expanded ? "Show fewer" : `Show all ${results.length} pressings`}
          </button>
        )}
        <div className="grow" />
        <button className="btn btn--xs btn--ghost" onClick={onManual}>None of these — enter manually</button>
      </div>
    </div>
  );
}

function ReviewStep({ draft, setDraft, onSave, onBack, saving, err, dupe }) {
  const auto = !!draft.discogs_release_id;
  function set(k, v) { setDraft((d) => ({ ...d, [k]: v })); }

  // House genres plus this release's Discogs genres/styles, Discogs first,
  // deduplicated so nothing appears twice in the dropdown.
  const genreOptions = [...new Set([...(draft.styleSuggestions || []), ...HOUSE_GENRES])];

  return (
    <div>
      <div className="addrec__pickhd">
        <div>
          <div className="addrec__picktitle">{auto ? "Check and save" : "Enter the details"}</div>
          <p className="addrec__lede">
            {auto ? "Pulled from Discogs — check the tracklist matches your copy." : "You can always enrich it from Discogs later."}
          </p>
        </div>
        <button className="btn btn--xs btn--ghost" onClick={onBack}>Back</button>
      </div>

      {dupe && (
        <div className="addrec__warn">
          Heads up — “{dupe.title}” is already in the collection under {dupe.owner}. Saving will create a second copy.
        </div>
      )}

      <div className="addrec__top">
        {draft.cover_url
          ? <img className="addrec__cover" src={draft.cover_url} alt="" />
          : <div className="addrec__cover addrec__cover--none">No cover</div>}
        <div className="addrec__topfields">
          <label><span>Artist</span><input className="input" value={draft.artist} onChange={(e)=>set("artist",e.target.value)} /></label>
          <label><span>Album</span><input className="input" value={draft.album} onChange={(e)=>set("album",e.target.value)} /></label>
        </div>
      </div>

      <div className="addrec__grid">
        <label><span>Label</span><input className="input" value={draft.label} onChange={(e)=>set("label",e.target.value)} /></label>
        <label><span>Catalog no.</span><input className="input mono" value={draft.catalog_no} onChange={(e)=>set("catalog_no",e.target.value)} /></label>
        <label><span>Genre</span>
          <input className="input" list="genrelist-add" value={draft.genre} onChange={(e)=>set("genre",e.target.value)} />
          <datalist id="genrelist-add">{genreOptions.map((g) => <option key={g} value={g} />)}</datalist>
        </label>
        <label><span>Original year</span><input className="input mono" value={draft.original_year} onChange={(e)=>set("original_year",e.target.value)} /></label>
        <label><span>Pressing year</span><input className="input mono" value={draft.pressing_year} onChange={(e)=>set("pressing_year",e.target.value)} /></label>
        <label><span>Format</span>
          <select className="input" value={draft.format} onChange={(e)=>set("format",e.target.value)}>
            {FORMATS.map((f) => <option key={f}>{f}</option>)}
          </select>
        </label>
      </div>

      {draft.tracks.length > 0 && (
        <div className="tracklist-preview">
          <div className="tracklist-preview__hd">
            Tracklist <span className="muted">— {draft.tracks.length} track{draft.tracks.length === 1 ? "" : "s"} will be saved</span>
          </div>
          <div className="tracklist-preview__grid">
            {draft.tracks.map((t, i) => (
              <div className="tracklist-preview__row" key={i}>
                <span className="tracklist-preview__pos mono">{t.position}</span>
                <span className="tracklist-preview__title">{t.title}</span>
                <span className="tracklist-preview__dur mono">{t.duration}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="addrec__grid">
        <label><span>Owner</span>
          <select className="input" value={draft.owner} onChange={(e)=>set("owner",e.target.value)}>
            {OWNERS.map((p) => <option key={p}>{p}</option>)}
          </select>
        </label>
      </div>

      <label className="addrec__notes"><span>Notes</span>
        <textarea
          className="input"
          rows={2}
          placeholder="Where you bought it, edition, who gave it to you…"
          value={draft.notes}
          onChange={(e)=>set("notes",e.target.value)}
        />
      </label>

      {err && <div className="addrec__err">{err}</div>}

      <div className="form__actions">
        <div className="grow" />
        <button className="btn btn--solid" onClick={onSave} disabled={saving}>
          {saving ? "Saving…" : "Add to collection"}
        </button>
      </div>
    </div>
  );
}

function AddNew({ onAdd }) {
  const [step, setStep] = useState_a("search"); // search | pick | review | done
  const [results, setResults] = useState_a([]);
  const [term, setTerm] = useState_a("");
  const [draft, setDraft] = useState_a(blankDraft());
  const [busy, setBusy] = useState_a(false);
  const [saving, setSaving] = useState_a(false);
  const [err, setErr] = useState_a("");
  const [dupe, setDupe] = useState_a(null);
  const [saved, setSaved] = useState_a(null);

  function reset() {
    setStep("search"); setResults([]); setTerm(""); setDraft(blankDraft());
    setErr(""); setDupe(null); setSaved(null);
  }

  async function toReview(rel) {
    const d = draftFromRelease(rel);
    setDraft(d);
    setErr("");
    setStep("review");
    // Warn (but never block) if this exact release is already filed under
    // the same owner -- a genuine second copy is allowed.
    try {
      const existing = await window.VC.findByDiscogsId(d.discogs_release_id, d.owner);
      setDupe(existing || null);
    } catch (_) { setDupe(null); }
  }

  async function save() {
    if (!draft.artist.trim() || !draft.album.trim()) {
      setErr("Artist and album are both required.");
      return;
    }
    setSaving(true); setErr("");
    try {
      const rec = await onAdd({
        ...draft,
        artist: draft.artist.trim(),
        album: draft.album.trim(),
        genres: draft.genre ? [draft.genre] : [],
        original_year: draft.original_year ? parseInt(draft.original_year, 10) || null : null,
        pressing_year: draft.pressing_year ? parseInt(draft.pressing_year, 10) || null : null,
      });
      setSaved(rec || { artist: draft.artist, album: draft.album, cover_url: draft.cover_url });
      setStep("done");
    } catch (e) {
      setErr("Couldn't save that — check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="admincard">
      <header className="admincard__hd"><h3>Add a record</h3></header>
      <div className="addrec">
        {step === "search" && (
          <SearchStep
            busy={busy} setBusy={setBusy}
            onResults={(r, t) => { setResults(r); setTerm(t); setStep("pick"); }}
            onRelease={toReview}
            onManual={() => { setDraft(blankDraft()); setDupe(null); setErr(""); setStep("review"); }}
          />
        )}

        {step === "pick" && (
          <PickStep
            results={results} term={term} busy={busy} setBusy={setBusy}
            onPick={toReview}
            onBack={reset}
            onManual={() => { setDraft(blankDraft()); setDupe(null); setErr(""); setStep("review"); }}
          />
        )}

        {step === "review" && (
          <ReviewStep
            draft={draft} setDraft={setDraft}
            onSave={save}
            onBack={() => (results.length ? setStep("pick") : reset())}
            saving={saving} err={err} dupe={dupe}
          />
        )}

        {step === "done" && saved && (
          <div>
            <div className="addrec__done">
              {saved.cover_url
                ? <img className="addrec__donecover" src={saved.cover_url} alt="" />
                : <div className="addrec__donecover addrec__donecover--none" />}
              <div>
                <div className="addrec__doneflag">✓ Added to the collection</div>
                <div className="addrec__donealbum">{saved.album}</div>
                <div className="muted small">{saved.artist}</div>
              </div>
            </div>
            <div className="form__actions">
              <div className="grow" />
              <button className="btn btn--solid" onClick={reset}>Add another</button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

// ── Wishlist ────────────────────────────────────────────────────────────────
// Same list as the add/edit forms -- kept as one definition so adding a
// genre in future only means editing HOUSE_GENRES above.
const GENRE_OPTIONS = HOUSE_GENRES;

function BuyForm({ item, onCancel, onConfirm }) {
  const [label, setLabel] = useState_a("");
  const [genre, setGenre] = useState_a("");
  const [format, setFormat] = useState_a("LP");
  const [notes, setNotes] = useState_a(item.note || "");
  return (
    <div className="wlist__buy">
      <div className="wlist__buy-grid">
        <label><span>Label</span><input className="input" value={label} onChange={(e)=>setLabel(e.target.value)} placeholder="e.g. Blue Note" /></label>
        <label><span>Genre</span>
          <input className="input" list="genrelist-buy" value={genre} onChange={(e)=>setGenre(e.target.value)} />
          <datalist id="genrelist-buy">{GENRE_OPTIONS.map((g)=> <option key={g} value={g} />)}</datalist>
        </label>
        <label><span>Format</span>
          <select className="input" value={format} onChange={(e)=>setFormat(e.target.value)}>
            <option>LP</option><option>EP</option><option>7"</option><option>10"</option><option>2xLP</option>
          </select>
        </label>
        <label className="span2"><span>Notes</span><input className="input" value={notes} onChange={(e)=>setNotes(e.target.value)} placeholder="Where bought, edition, gift from…" /></label>
      </div>
      <div className="wlist__buy-actions">
        <button className="btn btn--solid" onClick={() => onConfirm({ label, genre, format, notes })}>Promote to collection</button>
        <button className="btn btn--ghost" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}

function WishlistView({ items, onAdd, onRemove, onMarkBought }) {
  const [artist, setA] = useState_a("");
  const [album, setAl] = useState_a("");
  const [note, setNote] = useState_a("");
  const [buyingId, setBuyingId] = useState_a(null);

  return (
    <section className="admincard">
      <header className="admincard__hd"><h3>Wishlist <span className="muted small">— {items.length}</span></h3></header>
      <div className="wishlist__form">
        <input className="input" placeholder="Artist" value={artist} onChange={(e)=>setA(e.target.value)} />
        <input className="input" placeholder="Album" value={album} onChange={(e)=>setAl(e.target.value)} />
        <input className="input" placeholder="Note (optional)" value={note} onChange={(e)=>setNote(e.target.value)} />
        <button className="btn btn--solid" onClick={() => {
          if (!artist || !album) return;
          onAdd({ id: "w" + Date.now(), artist, album, note, label: "", genre: "" });
          setA(""); setAl(""); setNote("");
        }}>Add</button>
      </div>
      <ul className="wlist">
        {items.map((w) => (
          <li key={w.id} className={w.bought ? "wlist__row--bought" : ""}>
            <div className="wlist__row">
              <div className="wlist__main">
                <div className="wlist__artist">
                  {w.artist}
                  {w.bought && <span className="badge badge--bought" style={{position:"static",marginLeft:8}}>✓ Bought</span>}
                </div>
                <div className="wlist__album">{w.album}</div>
                {w.note && <div className="wlist__note">{w.note}</div>}
              </div>
              <div className="wlist__actions">
                {!w.bought && <button className="btn btn--xs btn--solid" onClick={() => setBuyingId(w.id === buyingId ? null : w.id)}>
                  {w.id === buyingId ? "Close" : "Mark bought →"}
                </button>}
                <button className="btn btn--xs btn--ghost wlist__delete" onClick={() => onRemove(w.id)} title="Remove from wishlist">Delete</button>
              </div>
            </div>
            {buyingId === w.id && (
              <BuyForm
                item={w}
                onCancel={() => setBuyingId(null)}
                onConfirm={(fields) => { onMarkBought(w, fields); setBuyingId(null); }}
              />
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

// ── Loan tracker ────────────────────────────────────────────────────────────
function LoansView({ loans, records, onReturn, onLoan }) {
  const [recId, setRid] = useState_a("");
  const [person, setPerson] = useState_a("");
  const [note, setNote] = useState_a("");
  const recById = Object.fromEntries(records.map((r) => [r.id, r]));

  return (
    <section className="admincard">
      <header className="admincard__hd"><h3>On loan <span className="muted small">— {loans.length}</span></h3></header>
      <div className="loans__form">
        <select className="input" value={recId} onChange={(e)=>setRid(e.target.value)}>
          <option value="">Select record…</option>
          {records.map((r) => <option key={r.id} value={r.id}>{r.artist} — {r.album}</option>)}
        </select>
        <input className="input" placeholder="Borrower" value={person} onChange={(e)=>setPerson(e.target.value)} />
        <input className="input" placeholder="Note (optional)" value={note} onChange={(e)=>setNote(e.target.value)} />
        <button className="btn btn--solid" onClick={() => {
          if (!recId || !person) return;
          onLoan({ recordId: parseInt(recId,10), person, note, since: new Date().toISOString().slice(0,10) });
          setRid(""); setPerson(""); setNote("");
        }}>Lend</button>
      </div>
      <ul className="loans">
        {loans.map((l, i) => {
          const r = recById[l.recordId];
          if (!r) return null;
          return (
            <li key={i}>
              <span className="loan-dot" />
              <div className="loans__main">
                <div className="loans__rec">{r.artist} — <span className="muted">{r.album}</span></div>
                <div className="loans__sub mono">{l.person.toUpperCase()} <span className="dot">·</span> SINCE {fmtDate(l.since).toUpperCase()}</div>
                {l.note && <div className="loans__note">{l.note}</div>}
              </div>
              <button className="btn btn--ghost" onClick={() => onReturn(i)}>Mark returned</button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

// ── Stats strip ─────────────────────────────────────────────────────────────
function Stats({ records, loans, wishlist }) {
  const total = records.length;
  const genres = new Set(records.map((r) => r.genre)).size;
  const artists = new Set(records.map((r) => r.artist)).size;
  const labels = new Set(records.map((r) => r.label)).size;
  const recent = [...records].sort((a, b) => (b.acquiredAt || b.acquired || "").localeCompare(a.acquiredAt || a.acquired || ""))[0];

  return (
    <section className="stats">
      <div className="stat"><div className="stat__n mono">{total}</div><div className="stat__l">Records</div></div>
      <div className="stat"><div className="stat__n mono">{genres}</div><div className="stat__l">Genres</div></div>
      <div className="stat"><div className="stat__n mono">{artists}</div><div className="stat__l">Artists</div></div>
      <div className="stat"><div className="stat__n mono">{labels}</div><div className="stat__l">Labels</div></div>
      <div className="stat"><div className="stat__n mono">{loans.length}</div><div className="stat__l">On loan</div></div>
      <div className="stat"><div className="stat__n mono">{wishlist.length}</div><div className="stat__l">Wishlist</div></div>
      {recent && <div className="stat stat--wide"><div className="stat__n stat__n--small">{recent.artist} — {recent.album}</div><div className="stat__l">Most recent acquisition</div></div>}
    </section>
  );
}

// ── Login gate ──────────────────────────────────────────────────────────────
// Real Supabase auth now, not a hardcoded password in the JS bundle.
// Only the account you create yourself (see rls_owner_fix.sql) can
// actually write anything -- the database enforces that, not this
// screen. This screen just gets you a session.
function AdminGate({ onUnlock }) {
  const [email, setEmail] = useState_a("");
  const [pw, setPw] = useState_a("");
  const [err, setErr] = useState_a("");
  const [busy, setBusy] = useState_a(false);

  async function submit(e) {
    e.preventDefault();
    if (!email.trim() || !pw || busy) return;
    setBusy(true);
    setErr("");
    try {
      await window.VC.signIn(email.trim(), pw);
      onUnlock();
    } catch (e2) {
      setErr("That didn't work -- check your email and password.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="gate">
      <form className="gate__box" onSubmit={submit}>
        <div className="gate__brand mono">VINILES &amp; GALLETAS / ADMIN</div>
        <h1 className="gate__title">Owner access</h1>
        <p className="gate__sub">Only Diego can add, edit, or approve records and notes.</p>
        <label className="lbl">Email</label>
        <input
          className="input gate__input"
          type="email"
          autoFocus
          value={email}
          onChange={(e)=>setEmail(e.target.value)}
          placeholder="you@email.com"
        />
        <label className="lbl" style={{ marginTop: 10 }}>Password</label>
        <input
          className={"input gate__input" + (err ? " input--err" : "")}
          type="password"
          value={pw}
          onChange={(e)=>setPw(e.target.value)}
          placeholder="••••••••"
        />
        <button className="btn btn--solid btn--block" type="submit" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
        {err && <div className="gate__hint mono" style={{ color: "var(--accent)" }}>{err}</div>}
      </form>
    </div>
  );
}

// Shared with detail.jsx's edit form so there is ONE definition of each
// list. detail.jsx reads these off window at render time, which is after
// every script has loaded.
window.HOUSE_GENRES = HOUSE_GENRES;
window.OWNERS = OWNERS;
window.FORMATS = FORMATS;

window.AddNew = AddNew;
window.WishlistView = WishlistView;
window.LoansView = LoansView;
window.Stats = Stats;
window.AdminGate = AdminGate;

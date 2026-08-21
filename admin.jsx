// admin.jsx — owner-only views: dashboard, add new, wishlist, loans

const { useState: useState_a, useEffect: useEffect_a } = React;

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
// Must match the records_format_check constraint in the database exactly
// (app/migrations/006_allow_multi_disc_formats.sql) -- offering a value
// the database rejects turns into a save error at the worst moment.
const FORMATS = ["LP", "2xLP", "3xLP", "EP", "Single", '12"', "Box Set"];

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

// The search -> pick -> review -> save flow on its own, with no chrome
// around it. Sessions reuses this when a friend brings an album that isn't
// in the collection yet, so those records arrive with cover art and a
// tracklist rather than as bare artist/title stubs.
//
// `onSaved` fires with the created record. `initialOwner` lets Sessions
// pre-set who brought it.
function AddRecordFlow({ onAdd, onSaved, initialOwner }) {
  const [step, setStep] = useState_a("search"); // search | pick | review
  const [results, setResults] = useState_a([]);
  const [term, setTerm] = useState_a("");
  const [draft, setDraft] = useState_a(() => ({ ...blankDraft(), owner: initialOwner || "Diego" }));
  const [busy, setBusy] = useState_a(false);
  const [saving, setSaving] = useState_a(false);
  const [err, setErr] = useState_a("");
  const [dupe, setDupe] = useState_a(null);

  function freshDraft() { return { ...blankDraft(), owner: initialOwner || "Diego" }; }

  function reset() {
    setStep("search"); setResults([]); setTerm(""); setDraft(freshDraft());
    setErr(""); setDupe(null);
  }

  async function toReview(rel) {
    const d = { ...draftFromRelease(rel), owner: initialOwner || "Diego" };
    setDraft(d);
    setErr("");
    setStep("review");
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
      onSaved(rec || { artist: draft.artist, album: draft.album, cover_url: draft.cover_url, owner: draft.owner });
      reset();
    } catch (e) {
      setErr("Couldn't save that — check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  const goManual = () => { setDraft(freshDraft()); setDupe(null); setErr(""); setStep("review"); };

  return (
    <div className="addrec">
      {step === "search" && (
        <SearchStep
          busy={busy} setBusy={setBusy}
          onResults={(r, t) => { setResults(r); setTerm(t); setStep("pick"); }}
          onRelease={toReview}
          onManual={goManual}
        />
      )}
      {step === "pick" && (
        <PickStep
          results={results} term={term} busy={busy} setBusy={setBusy}
          onPick={toReview}
          onBack={reset}
          onManual={goManual}
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
    </div>
  );
}

function AddNew({ onAdd }) {
  const [saved, setSaved] = useState_a(null);
  const [nonce, setNonce] = useState_a(0); // remounts the flow for "Add another"

  if (saved) {
    return (
      <section className="admincard">
        <header className="admincard__hd"><h3>Add a record</h3></header>
        <div className="addrec">
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
            <button className="btn btn--solid" onClick={() => { setSaved(null); setNonce((n) => n + 1); }}>Add another</button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="admincard">
      <header className="admincard__hd"><h3>Add a record</h3></header>
      <AddRecordFlow key={nonce} onAdd={onAdd} onSaved={setSaved} />
    </section>
  );
}

// ── Wishlist ────────────────────────────────────────────────────────────────



// Adding to the wishlist: the same Discogs search the collection uses,
// but it stops once you've picked a pressing -- there's no review screen,
// because a wishlist entry isn't a record yet. The pressing is stored as a
// reference, not a commitment; you confirm it when you actually buy.
function WishlistAdd({ onSave, onCancel }) {
  const [step, setStep] = useState_a("search"); // search | pick | manual
  const [results, setResults] = useState_a([]);
  const [term, setTerm] = useState_a("");
  const [busy, setBusy] = useState_a(false);
  const [err, setErr] = useState_a("");

  // Hand-typed fallback, for records Discogs doesn't have.
  const [artist, setArtist] = useState_a("");
  const [album, setAlbum] = useState_a("");
  const [note, setNote] = useState_a("");

  async function fromRelease(rel) {
    setBusy(true);
    try {
      await onSave({
        artist: rel.artist,
        album: rel.title,
        note: "",
        discogs_release_id: rel.discogs_release_id,
        cover_url: rel.cover_url,
        label: rel.label,
        catalog_no: rel.catalog_no,
        pressing_year: rel.pressing_year,
        format: rel.format,
      });
    } catch (e) {
      setErr("Couldn't save that — check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  if (step === "manual") {
    return (
      <div className="addrec">
        <div className="addrec__pickhd">
          <div>
            <div className="addrec__picktitle">Add by hand</div>
            <p className="addrec__lede">No cover art or metadata — you can always replace it later.</p>
          </div>
          <button className="btn btn--xs btn--ghost" onClick={() => setStep("search")}>Back</button>
        </div>
        <div className="addrec__grid">
          <label><span>Artist</span><input className="input" autoFocus value={artist} onChange={(e)=>{setArtist(e.target.value);setErr("");}} /></label>
          <label><span>Album</span><input className="input" value={album} onChange={(e)=>{setAlbum(e.target.value);setErr("");}} /></label>
        </div>
        <label className="addrec__notes"><span>Note</span>
          <input className="input" value={note} onChange={(e)=>setNote(e.target.value)} placeholder="Why you want it, who mentioned it…" />
        </label>
        {err && <div className="addrec__err">{err}</div>}
        <div className="form__actions">
          <div className="grow" />
          <button className="btn btn--ghost" onClick={onCancel}>Cancel</button>
          <button className="btn btn--solid" disabled={busy} onClick={async () => {
            if (!artist.trim()) { setErr("An artist is required."); return; }
            setBusy(true);
            try { await onSave({ artist: artist.trim(), album: album.trim(), note: note.trim() }); }
            catch (e) { setErr("Couldn't save that — try again."); setBusy(false); }
          }}>{busy ? "Adding…" : "Add to wishlist"}</button>
        </div>
      </div>
    );
  }

  if (step === "pick") {
    return (
      <div className="addrec">
        {/* PickStep fetches the release itself and hands the full object
            to onPick -- don't look it up a second time. */}
        <PickStep
          results={results} term={term} busy={busy} setBusy={setBusy}
          onPick={fromRelease}
          onBack={() => setStep("search")}
          onManual={() => setStep("manual")}
        />
        {err && <div className="addrec__err">{err}</div>}
      </div>
    );
  }

  return (
    <div className="addrec">
      <SearchStep
        busy={busy} setBusy={setBusy}
        onResults={(r, t) => { setResults(r); setTerm(t); setStep("pick"); }}
        onRelease={fromRelease}
        onManual={() => setStep("manual")}
      />
      {err && <div className="addrec__err">{err}</div>}
      <div className="addrec__footrow">
        <div className="grow" />
        <button className="btn btn--xs btn--ghost" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}

// Marking a wishlist item bought. Re-fetches the release rather than
// trusting what was stored when you wishlisted it -- you may have wanted
// the 2019 reissue and come home with an original, and metadata that sat
// on a want-list for two years is worth refreshing anyway.
function BuyFlow({ item, onConfirm, onCancel }) {
  const [draft, setDraft] = useState_a(null);
  const [loading, setLoading] = useState_a(!!item.discogs_release_id);
  const [saving, setSaving] = useState_a(false);
  const [err, setErr] = useState_a("");

  useEffect_a(() => {
    let cancelled = false;
    async function load() {
      if (!item.discogs_release_id) {
        // Hand-typed wishlist entry: nothing to fetch, start from what we have.
        setDraft({ ...blankDraft(), artist: item.artist, album: item.album, notes: item.note || "" });
        return;
      }
      try {
        const rel = await window.VC.discogsRelease(item.discogs_release_id);
        if (!cancelled) setDraft({ ...draftFromRelease(rel), notes: item.note || "" });
      } catch (e) {
        if (!cancelled) {
          // Discogs unreachable shouldn't block you from filing a record you
          // physically own -- fall back to what the wishlist already knows.
          setErr("Couldn't reach Discogs — filling in from the wishlist entry instead.");
          setDraft({
            ...blankDraft(),
            artist: item.artist, album: item.album, notes: item.note || "",
            label: item.label || "", catalog_no: item.catalog_no || "",
            pressing_year: item.pressing_year || "", cover_url: item.cover_url || "",
            discogs_release_id: item.discogs_release_id,
            format: FORMATS.includes(item.format) ? item.format : "LP",
          });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [item.id]);

  if (loading || !draft) {
    return <div className="wlist__buy"><span className="muted small">Refreshing from Discogs…</span></div>;
  }

  return (
    <div className="wlist__buy">
      {err && <div className="addrec__err">{err}</div>}
      <ReviewStep
        draft={draft} setDraft={setDraft}
        saving={saving}
        err=""
        dupe={null}
        onBack={onCancel}
        onSave={async () => {
          if (!draft.artist.trim() || !draft.album.trim()) {
            setErr("Artist and album are both required.");
            return;
          }
          setSaving(true);
          try {
            await onConfirm({
              ...draft,
              artist: draft.artist.trim(),
              album: draft.album.trim(),
              genres: draft.genre ? [draft.genre] : [],
              original_year: draft.original_year ? parseInt(draft.original_year, 10) || null : null,
              pressing_year: draft.pressing_year ? parseInt(draft.pressing_year, 10) || null : null,
            });
          } catch (e) {
            setErr("Couldn't save that — check your connection and try again.");
            setSaving(false);
          }
        }}
      />
    </div>
  );
}

function WishlistView({ items, onAdd, onRemove, onMarkBought, onOpen }) {
  const [adding, setAdding] = useState_a(false);
  const [buyingId, setBuyingId] = useState_a(null);

  const want = items.filter((w) => !w.bought);
  const bought = items.filter((w) => w.bought);

  function Row(w) {
    return (
      <li key={w.id} className={w.bought ? "wlist__row--bought" : ""}>
        <div className="wlist__row">
          {/* Cover and text open a read-only preview; the action buttons
              sit outside so clicking Delete never opens the panel. */}
          <button type="button" className="wlist__open" onClick={() => onOpen && onOpen(w)}>
            {w.cover_url
              ? <img className="wlist__art" src={w.cover_url} alt="" loading="lazy" />
              : <div className="wlist__art wlist__art--none" />}
          <div className="wlist__main">
            <div className="wlist__album">
              {w.album || <span className="muted">Album TBD</span>}
              {w.bought && <span className="badge badge--bought" style={{ position: "static", marginLeft: 8 }}>✓ Bought</span>}
            </div>
            <div className="wlist__artist">{w.artist}</div>
            {(w.label || w.catalog_no || w.pressing_year) && (
              <div className="wlist__press mono">
                {[w.label, w.catalog_no, w.pressing_year].filter(Boolean).join(" · ")}
              </div>
            )}
            {w.note && <div className="wlist__note">{w.note}</div>}
          </div>
          </button>
          <div className="wlist__actions">
            {!w.bought && (
              <button className="btn btn--xs btn--solid" onClick={() => setBuyingId(w.id === buyingId ? null : w.id)}>
                {w.id === buyingId ? "Close" : "Mark bought →"}
              </button>
            )}
            <button className="btn btn--xs btn--ghost wlist__delete" onClick={() => onRemove(w.id)} title="Remove from wishlist">Delete</button>
          </div>
        </div>
        {buyingId === w.id && (
          <BuyFlow
            item={w}
            onCancel={() => setBuyingId(null)}
            onConfirm={async (fields) => { await onMarkBought(w, fields); setBuyingId(null); }}
          />
        )}
      </li>
    );
  }

  return (
    <section className="admincard">
      <header className="admincard__hd">
        <h3>Wishlist <span className="muted small">— {want.length}</span></h3>
        {!adding && <button className="btn btn--xs btn--solid" onClick={() => setAdding(true)}>+ Add to wishlist</button>}
      </header>

      {adding && (
        <WishlistAdd
          onCancel={() => setAdding(false)}
          onSave={async (fields) => { await onAdd(fields); setAdding(false); }}
        />
      )}

      <ul className="wlist">{want.map(Row)}</ul>

      {bought.length > 0 && (
        <>
          <div className="wlist__divider"><span className="mono">BOUGHT · {bought.length}</span></div>
          <ul className="wlist">{bought.map(Row)}</ul>
        </>
      )}
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
window.AddRecordFlow = AddRecordFlow;
window.HOUSE_GENRES = HOUSE_GENRES;
window.OWNERS = OWNERS;
window.FORMATS = FORMATS;

window.AddNew = AddNew;
window.WishlistView = WishlistView;
window.LoansView = LoansView;
window.Stats = Stats;
window.AdminGate = AdminGate;

// detail.jsx — record detail view (modal/overlay) with cover, tracklist, notes from friends

const { useState: useState_d, useEffect: useEffect_d } = React;

// "Date added" = when the row was created in the database, which for the
// original collection is the day of the bulk import rather than the day
// you actually bought the record. Accurate from here on.
function fmtAdded(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d)) return "";
  return d.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
}

// ── Edit a record (owner only) ──────────────────────────────────────────
// Lives here rather than in admin.jsx because you fix a record while
// LOOKING at it -- spotting a wrong genre happens on the detail page,
// not on a separate admin screen.
//
// Cover art, tracklist and the Discogs release id aren't editable: they
// were fetched as a set from one specific pressing, and hand-editing them
// apart would leave the record disagreeing with itself. If the wrong
// pressing got picked, re-add the right one.
function EditRecord({ rec, onSave, onCancel }) {
  const GENRES = window.HOUSE_GENRES || [];
  const OWNERS_L = window.OWNERS || ["Diego"];
  const FORMATS_L = window.FORMATS || ["LP"];

  const [f, setF] = useState_d({
    artist: rec.artist || "",
    album: rec.album || "",
    genre: (rec.genres && rec.genres[0]) || rec.genre || "",
    format: rec.format || "LP",
    label: rec.label || "",
    catalog_no: rec.catalog_no || "",
    original_year: rec.original_year || "",
    pressing_year: rec.pressing_year || "",
    owner: rec.owner || "Diego",
    notes: rec.notes || "",
    history: rec.history || "",
    listening_notes: rec.listening_notes || "",
  });
  const [saving, setSaving] = useState_d(false);
  const [err, setErr] = useState_d("");

  function set(k, v) { setF((p) => ({ ...p, [k]: v })); setErr(""); }

  async function save() {
    if (!f.artist.trim() || !f.album.trim()) {
      setErr("Artist and album are both required.");
      return;
    }
    setSaving(true); setErr("");
    try {
      await onSave(rec.id, {
        ...f,
        artist: f.artist.trim(),
        album: f.album.trim(),
        original_year: f.original_year ? parseInt(f.original_year, 10) || null : null,
        pressing_year: f.pressing_year ? parseInt(f.pressing_year, 10) || null : null,
      });
      onCancel();
    } catch (e) {
      setErr("Couldn't save that — check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="editrec">
      <div className="editrec__hd">
        <span className="section-h" style={{ margin: 0 }}>Editing this record</span>
        <button className="btn btn--xs btn--ghost" onClick={onCancel}>Cancel</button>
      </div>

      <div className="addrec__grid">
        <label><span>Artist</span><input className="input" value={f.artist} onChange={(e)=>set("artist",e.target.value)} /></label>
        <label><span>Album</span><input className="input" value={f.album} onChange={(e)=>set("album",e.target.value)} /></label>
        <label><span>Genre</span>
          <input className="input" list="genrelist-edit" value={f.genre} onChange={(e)=>set("genre",e.target.value)} />
          <datalist id="genrelist-edit">{GENRES.map((g) => <option key={g} value={g} />)}</datalist>
        </label>
        <label><span>Format</span>
          <select className="input" value={f.format} onChange={(e)=>set("format",e.target.value)}>
            {FORMATS_L.map((x) => <option key={x}>{x}</option>)}
          </select>
        </label>
        <label><span>Label</span><input className="input" value={f.label} onChange={(e)=>set("label",e.target.value)} /></label>
        <label><span>Catalog no.</span><input className="input mono" value={f.catalog_no} onChange={(e)=>set("catalog_no",e.target.value)} /></label>
        <label><span>Released</span><input className="input mono" value={f.original_year} onChange={(e)=>set("original_year",e.target.value)} /></label>
        <label><span>This pressing</span><input className="input mono" value={f.pressing_year} onChange={(e)=>set("pressing_year",e.target.value)} /></label>
        <label><span>Owner</span>
          <select className="input" value={f.owner} onChange={(e)=>set("owner",e.target.value)}>
            {OWNERS_L.map((p) => <option key={p}>{p}</option>)}
          </select>
        </label>
      </div>

      <label className="addrec__notes"><span>Notes</span>
        <textarea className="input" rows={2} value={f.notes} onChange={(e)=>set("notes",e.target.value)} placeholder="Where bought, edition, gift from…" />
      </label>
      <label className="addrec__notes"><span>History</span>
        <textarea className="input" rows={3} value={f.history} onChange={(e)=>set("history",e.target.value)} placeholder="The story of the record itself…" />
      </label>
      <label className="addrec__notes"><span>Listening notes</span>
        <textarea className="input" rows={3} value={f.listening_notes} onChange={(e)=>set("listening_notes",e.target.value)} placeholder="What to listen for…" />
      </label>

      {err && <div className="addrec__err">{err}</div>}

      <div className="form__actions">
        <span className="muted small">Cover art and tracklist come from Discogs and aren't editable here.</span>
        <div className="grow" />
        <button className="btn btn--solid" onClick={save} disabled={saving}>{saving ? "Saving…" : "Save changes"}</button>
      </div>
    </div>
  );
}

// The prototype's "MiniReview" called window.claude.complete() to
// generate AI liner notes on the fly. That only works inside the
// claude.ai artifact sandbox -- on a real deployed site there's no
// such function, and calling a real AI API would mean a paid key,
// which breaks the $0 constraint. Instead we show YOUR OWN history
// and listening-notes fields, written once and stored for free.
function AlbumContext({ rec }) {
  const hasHistory = rec.history && rec.history.trim();
  const hasListening = rec.listening_notes && rec.listening_notes.trim();
  if (!hasHistory && !hasListening) {
    return (
      <div className="review">
        <h4 className="section-h">The take</h4>
        <p className="muted small">No context written for this one yet.</p>
      </div>
    );
  }
  return (
    <div className="review">
      {hasHistory && (
        <>
          <h4 className="section-h">History</h4>
          <p className="review__text">{rec.history}</p>
        </>
      )}
      {hasListening && (
        <>
          <h4 className="section-h" style={{ marginTop: hasHistory ? 16 : 0 }}>Listening notes</h4>
          <p className="review__text">{rec.listening_notes}</p>
        </>
      )}
    </div>
  );
}

function Tracklist({ tracks }) {
  if (!tracks || tracks.length === 0) {
    return <div className="muted small">No tracklist on file for this pressing.</div>;
  }
  return (
    <ol className="tracklist" style={{ listStyle: "none", padding: 0, margin: 0 }}>
      {tracks.map((t, i) => (
        <li key={i} style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "4px 0", fontSize: 14 }}>
          <span><span className="mono muted" style={{ marginRight: 10 }}>{t.position}</span>{t.title}</span>
          {t.duration && <span className="mono muted">{t.duration}</span>}
        </li>
      ))}
    </ol>
  );
}

function Notes({ recId, isOwner }) {
  const [items, setItems] = useState_d([]);
  const [loading, setLoading] = useState_d(true);
  const [name, setName] = useState_d(() => { try { return localStorage.getItem("vc.name") || ""; } catch { return ""; } });
  const [text, setText] = useState_d("");
  const [posted, setPosted] = useState_d(false);
  const [err, setErr] = useState_d("");

  useEffect_d(() => {
    let cancelled = false;
    setLoading(true);
    setPosted(false);
    window.VC.fetchApprovedNotes(recId)
      .then((n) => { if (!cancelled) setItems(n); })
      .catch(() => { if (!cancelled) setItems([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [recId]);

  async function add() {
    if (!name.trim() || !text.trim()) return;
    setErr("");
    try {
      try { localStorage.setItem("vc.name", name); } catch {}
      await window.VC.insertNote(recId, name.trim(), text.trim());
      setText("");
      setPosted(true);
    } catch (e) {
      setErr("Couldn't post that -- try again in a moment.");
    }
  }

  return (
    <div className="comments">
      <h4 className="section-h">Notes from friends</h4>
      {loading && <div className="muted small">Loading…</div>}
      {!loading && items.length === 0 && <div className="muted small">No notes yet — be the first.</div>}
      <ul className="comments__list">
        {items.map((c, i) => (
          <li key={i}>
            <div className="comments__who">
              <span>{c.who}</span><span className="dot">·</span><span className="mono">{c.when}</span>
            </div>
            <div className="comments__text">{c.text}</div>
          </li>
        ))}
      </ul>
      <div className="comments__form">
        <input className="input" placeholder="Your name" value={name} onChange={(e)=>setName(e.target.value)} />
        <textarea className="input" rows={2} placeholder="Leave a note…" value={text} onChange={(e)=>setText(e.target.value)} />
        <button className="btn btn--solid" onClick={add} disabled={!name.trim() || !text.trim()}>Post note</button>
        {posted && <div className="muted small" style={{ marginTop: 6 }}>Thanks — Diego reviews notes before they show up here.</div>}
        {err && <div className="muted small" style={{ marginTop: 6, color: "var(--accent)" }}>{err}</div>}
      </div>
    </div>
  );
}

function Detail({ rec, onClose, isOwner, onSaveRecord }) {
  if (!rec) return null;
  const [editing, setEditing] = useState_d(false);

  // Close the editor when you switch to a different record, otherwise the
  // form would sit there still holding the previous record's values.
  useEffect_d(() => { setEditing(false); }, [rec.id]);

  useEffect_d(() => {
    // While editing, Escape should back out of the form rather than close
    // the whole record -- losing typed changes to a stray keypress is a
    // nasty surprise.
    const onKey = (e) => {
      if (e.key !== "Escape") return;
      if (editing) setEditing(false);
      else onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, editing]);

  const spotifySearch = `https://open.spotify.com/search/${encodeURIComponent(rec.artist + " " + rec.album)}`;
  const appleSearch = `https://music.apple.com/us/search?term=${encodeURIComponent(rec.artist + " " + rec.album)}`;
  const tidalSearch = `https://tidal.com/browse/search?q=${encodeURIComponent(rec.artist + " " + rec.album)}`;

  return (
    <div className="overlay" onClick={onClose}>
      <article className="detail" onClick={(e) => e.stopPropagation()}>
        <header className="detail__hd">
          <div className="detail__crumb mono">
            <span>VINILES &amp; GALLETAS</span>
            <span className="dot">/</span>
            <span>{(rec.genre || "").toUpperCase()}</span>
          </div>
          <div className="detail__hdactions">
            {isOwner && onSaveRecord && !editing && (
              <button className="btn btn--xs btn--ghost" onClick={() => setEditing(true)}>Edit</button>
            )}
            <button className="iconbtn" onClick={onClose} aria-label="Close">×</button>
          </div>
        </header>

        <div className="detail__body">
          <div className="detail__left">
            <div className="detail__sleeve">
              <CoverArt artist={rec.artist} album={rec.album} size={520} coverUrl={rec.cover_url} />
            </div>

            <div className="detail__listen">
              <h4 className="section-h">Listen on</h4>
              <div className="listen__btns">
                <a className="listen__btn" href={tidalSearch} target="_blank" rel="noreferrer" data-svc="tidal">
                  <span className="listen__btn-lbl">Tidal</span>
                  <span className="listen__btn-arrow mono" aria-hidden="true">↗</span>
                </a>
                <a className="listen__btn" href={spotifySearch} target="_blank" rel="noreferrer" data-svc="spotify">
                  <span className="listen__btn-lbl">Spotify</span>
                  <span className="listen__btn-arrow mono" aria-hidden="true">↗</span>
                </a>
                <a className="listen__btn" href={appleSearch} target="_blank" rel="noreferrer" data-svc="apple">
                  <span className="listen__btn-lbl">Apple Music</span>
                  <span className="listen__btn-arrow mono" aria-hidden="true">↗</span>
                </a>
              </div>
              <div className="listen__embed listen__embed--review">
                <AlbumContext rec={rec} />
              </div>
            </div>
          </div>

          <div className="detail__right">
            <h1 className="detail__album">{rec.album}</h1>
            <h2 className="detail__artist">{rec.artist}</h2>

            {editing && (
              <EditRecord rec={rec} onSave={onSaveRecord} onCancel={() => setEditing(false)} />
            )}

            <dl className="kv">
              <div><dt>Genre</dt><dd>{(rec.genres && rec.genres.length ? rec.genres.join(", ") : rec.genre)}</dd></div>
              <div><dt>Format</dt><dd>{rec.format}</dd></div>
              <div><dt>Label</dt><dd>{rec.label}</dd></div>
              {rec.original_year && <div><dt>Released</dt><dd>{rec.original_year}</dd></div>}
              {rec.pressing_year && rec.pressing_year !== rec.original_year && <div><dt>This pressing</dt><dd>{rec.pressing_year}</dd></div>}
              {rec.catalog_no && <div><dt>Catalog</dt><dd className="mono">{rec.catalog_no}</dd></div>}
              {rec.acquiredAt && <div><dt>Date added</dt><dd className="mono">{fmtAdded(rec.acquiredAt)}</dd></div>}
              <div>
                <dt>Played @ V&amp;G</dt>
                <dd>
                  {rec.featuredVG ? (
                    <span className="badge badge--featured" title="Played at a Viniles &amp; Galletas session">★ Yes</span>
                  ) : (
                    <span className="badge badge--notyet">Not yet</span>
                  )}
                </dd>
              </div>
            </dl>

            {rec.notes && (
              <div className="detail__notes">
                <h4 className="section-h">Notes</h4>
                <p>{rec.notes}</p>
              </div>
            )}

            <div className="detail__tracklist" style={{ marginTop: 20 }}>
              <h4 className="section-h">Tracklist</h4>
              <Tracklist tracks={rec.tracks} />
            </div>

            <Notes recId={rec.id} isOwner={isOwner} />
          </div>
        </div>
      </article>
    </div>
  );
}

window.Detail = Detail;

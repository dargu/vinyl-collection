// detail.jsx — record detail view (modal/overlay) with cover, tracklist, notes from friends

const { useState: useState_d, useEffect: useEffect_d } = React;

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

function Detail({ rec, onClose, isOwner }) {
  if (!rec) return null;

  useEffect_d(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

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
          <button className="iconbtn" onClick={onClose} aria-label="Close">×</button>
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

            <dl className="kv">
              <div><dt>Genre</dt><dd>{(rec.genres && rec.genres.length ? rec.genres.join(", ") : rec.genre)}</dd></div>
              <div><dt>Format</dt><dd>{rec.format}</dd></div>
              <div><dt>Label</dt><dd>{rec.label}</dd></div>
              {rec.original_year && <div><dt>Released</dt><dd>{rec.original_year}</dd></div>}
              {rec.pressing_year && rec.pressing_year !== rec.original_year && <div><dt>This pressing</dt><dd>{rec.pressing_year}</dd></div>}
              {rec.catalog_no && <div><dt>Catalog</dt><dd className="mono">{rec.catalog_no}</dd></div>}
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

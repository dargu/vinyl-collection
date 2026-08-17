// shelf.jsx — main browse view + filters

const { useState, useMemo, useEffect, useRef } = React;

// ── tiny utilities ──────────────────────────────────────────────────────────
function uniq(arr) { return Array.from(new Set(arr)).filter(Boolean); }
function fmtDate(s) {
  if (!s) return "—";
  const [y, m] = s.split("-");
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${months[parseInt(m,10)-1]} ${y}`;
}

// ── filter chip ─────────────────────────────────────────────────────────────
function Chip({ active, onClick, children, count }) {
  return (
    <button className={"chip" + (active ? " chip--on" : "")} onClick={onClick}>
      <span>{children}</span>
      {count != null && <span className="chip__count">{count}</span>}
    </button>
  );
}

// ── one record on a shelf ───────────────────────────────────────────────────
function ShelfRecord({ rec, onOpen, density, isLoaned }) {
  // base sleeve size — gets overridden on mobile via CSS for a 3-up grid
  const sleeveSize = density === "compact" ? 130 : density === "comfy" ? 200 : 162;
  return (
    <button className="rec" onClick={() => onOpen(rec)} style={{ width: sleeveSize, "--sleeveSize": sleeveSize + "px" }}>
      <div className="rec__sleeve" style={{ width: sleeveSize, height: sleeveSize }}>
        <CoverArt artist={rec.artist} album={rec.album} size={sleeveSize} coverUrl={rec.cover_url} />
        {isLoaned && <span className="rec__loan" title="On loan" />}
      </div>
      <div className="rec__meta">
        <div className="rec__artist">{rec.artist}</div>
        <div className="rec__album">{rec.album}</div>
      </div>
    </button>
  );
}

// ── shelf row (one genre = one shelf) ───────────────────────────────────────
function Shelf({ title, records, onOpen, density, loans }) {
  const loanedIds = new Set(loans.map((l) => l.recordId));
  return (
    <section className="shelf">
      <header className="shelf__hd">
        <h2 className="shelf__title">{title}</h2>
        <span className="shelf__count">{records.length} <span>·</span> {records.length === 1 ? "record" : "records"}</span>
      </header>
      <div className="shelf__row">
        {records.map((r) => (
          <ShelfRecord key={r.id} rec={r} onOpen={onOpen} density={density} isLoaned={loanedIds.has(r.id)} />
        ))}
      </div>
    </section>
  );
}

// ── main browse ─────────────────────────────────────────────────────────────
function ShelfView({ records, onOpen, density, loans }) {
  const [q, setQ] = useState("");
  const [genre, setGenre] = useState("All");
  const [artist, setArtist] = useState("All");
  const [label, setLabel] = useState("All");
  const [sort, setSort] = useState("genre"); // genre | acquired-desc | acquired-asc | artist
  const [groupOpen, setGroupOpen] = useState(false);

  const genres = useMemo(() => ["All", ...uniq(records.map((r) => r.genre)).sort()], [records]);
  const artists = useMemo(() => ["All", ...uniq(records.map((r) => r.artist)).sort()], [records]);
  const labels = useMemo(() => ["All", ...uniq(records.map((r) => r.label)).sort()], [records]);

  const filtered = useMemo(() => {
    const ql = q.trim().toLowerCase();
    return records.filter((r) => {
      if (genre !== "All" && r.genre !== genre) return false;
      if (artist !== "All" && r.artist !== artist) return false;
      if (label !== "All" && r.label !== label) return false;
      if (ql && !(`${r.artist} ${r.album}`.toLowerCase().includes(ql))) return false;
      return true;
    });
  }, [records, q, genre, artist, label]);

  // grouped by current sort
  const groups = useMemo(() => {
    if (sort === "genre") {
      const m = new Map();
      filtered.forEach((r) => {
        if (!m.has(r.genre)) m.set(r.genre, []);
        m.get(r.genre).push(r);
      });
      const ordered = Array.from(m.entries()).sort((a, b) => b[1].length - a[1].length);
      ordered.forEach(([, arr]) => arr.sort((a, b) => a.artist.localeCompare(b.artist) || a.album.localeCompare(b.album)));
      return ordered.map(([k, arr]) => [k, arr]);
    }
    if (sort === "artist") {
      const m = new Map();
      filtered.forEach((r) => {
        const k = r.artist[0].toUpperCase();
        if (!m.has(k)) m.set(k, []);
        m.get(k).push(r);
      });
      const ordered = Array.from(m.entries()).sort((a, b) => a[0].localeCompare(b[0]));
      ordered.forEach(([, arr]) => arr.sort((a, b) => a.artist.localeCompare(b.artist) || a.album.localeCompare(b.album)));
      return ordered;
    }
    // acquired -- sort on the FULL timestamp, not the YYYY-MM used for the
    // year headings below. Sorting on the month alone made everything added
    // in the same month tie, so a record added today wouldn't come first.
    const sorted = [...filtered].sort((a, b) => {
      const ka = a.acquiredAt || a.acquired || "0000", kb = b.acquiredAt || b.acquired || "0000";
      return sort === "acquired-desc" ? kb.localeCompare(ka) : ka.localeCompare(kb);
    });
    const m = new Map();
    sorted.forEach((r) => {
      const k = (r.acquired || "Unknown").slice(0, 4);
      if (!m.has(k)) m.set(k, []);
      m.get(k).push(r);
    });
    const entries = Array.from(m.entries());
    if (sort === "acquired-desc") entries.sort((a, b) => b[0].localeCompare(a[0]));
    else entries.sort((a, b) => a[0].localeCompare(b[0]));
    return entries;
  }, [filtered, sort]);

  // counts for the genre rail
  const genreCounts = useMemo(() => {
    const m = {};
    records.forEach((r) => { m[r.genre] = (m[r.genre] || 0) + 1; });
    return m;
  }, [records]);

  return (
    <div className="browse">
      {/* sticky filter bar */}
      <div className="filterbar">
        <div className="filterbar__row">
          <div className="search">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" />
            </svg>
            <input
              placeholder="Search title or artist…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            {q && <button className="search__x" onClick={() => setQ("")}>×</button>}
          </div>
          <div className="select">
            <label>Sort</label>
            <select value={sort} onChange={(e) => setSort(e.target.value)}>
              <option value="genre">By genre</option>
              <option value="artist">By artist</option>
              <option value="acquired-desc">Newest first</option>
              <option value="acquired-asc">Oldest first</option>
            </select>
          </div>
          <div className="select">
            <label>Artist</label>
            <select value={artist} onChange={(e) => setArtist(e.target.value)}>
              {artists.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          <div className="select">
            <label>Label</label>
            <select value={label} onChange={(e) => setLabel(e.target.value)}>
              {labels.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
        </div>

        <div className="chiprow">
          {genres.map((g) => (
            <Chip key={g} active={genre === g} onClick={() => setGenre(g)} count={g === "All" ? records.length : genreCounts[g]}>
              {g}
            </Chip>
          ))}
        </div>
      </div>

      {/* shelves */}
      <div className="shelves">
        {filtered.length === 0 && (
          <div className="empty">
            <div className="empty__title">No records match those filters.</div>
            <button className="btn btn--ghost" onClick={() => { setQ(""); setGenre("All"); setArtist("All"); setLabel("All"); }}>
              Reset filters
            </button>
          </div>
        )}
        {groups.map(([title, arr]) => (
          <Shelf key={title} title={title} records={arr} onOpen={onOpen} density={density} loans={loans} />
        ))}
      </div>
    </div>
  );
}

window.ShelfView = ShelfView;
window.fmtDate = fmtDate;

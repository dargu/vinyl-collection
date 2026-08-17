// dashboard.jsx — owner dashboard: at-a-glance status, infographics, quick actions

const { useMemo: useMemo_db } = React;

// ── tiny infographic primitives ─────────────────────────────────────────────

// Horizontal bar list — for genre / decade breakdowns
function BarList({ rows, max, accent }) {
  const m = max || Math.max(...rows.map((r) => r.value));
  return (
    <ul className="barlist">
      {rows.map((r) => (
        <li key={r.label}>
          <span className="barlist__lbl">{r.label}</span>
          <span className="barlist__track">
            <span
              className="barlist__bar"
              style={{ width: `${(r.value / m) * 100}%`, background: accent ? "var(--accent)" : "var(--ink)" }}
            />
          </span>
          <span className="barlist__val mono">{r.value}</span>
        </li>
      ))}
    </ul>
  );
}

// Acquisition timeline removed — sheet doesn't have acquisition dates.
// Replaced by FeaturedRecap below.
function YearChart() { return null; }

// Donut for format split
function FormatDonut({ records }) {
  const m = {};
  records.forEach((r) => { m[r.format] = (m[r.format] || 0) + 1; });
  const total = records.length;
  const slices = Object.entries(m).sort((a, b) => b[1] - a[1]);
  const C = 2 * Math.PI * 42;
  let offset = 0;
  const colors = ["var(--ink)", "var(--accent)", "var(--muted)", "var(--muted-2)"];
  return (
    <div className="donut">
      <svg viewBox="0 0 100 100" width="100" height="100">
        <circle cx="50" cy="50" r="42" fill="none" stroke="var(--hair)" strokeWidth="14" />
        {slices.map(([k, v], i) => {
          const len = (v / total) * C;
          const dasharray = `${len} ${C - len}`;
          const el = (
            <circle
              key={k}
              cx="50" cy="50" r="42" fill="none"
              stroke={colors[i % colors.length]} strokeWidth="14"
              strokeDasharray={dasharray}
              strokeDashoffset={-offset}
              transform="rotate(-90 50 50)"
            />
          );
          offset += len;
          return el;
        })}
        <text x="50" y="48" textAnchor="middle" fontSize="14" fontWeight="600" fill="var(--ink)" fontFamily="var(--font-sans)">{total}</text>
        <text x="50" y="62" textAnchor="middle" fontSize="6" letterSpacing="0.1em" fill="var(--muted)" fontFamily="var(--font-mono)">RECORDS</text>
      </svg>
      <ul className="donut__legend">
        {slices.map(([k, v], i) => (
          <li key={k}>
            <span className="donut__sw" style={{ background: colors[i % colors.length] }} />
            <span>{k}</span>
            <span className="mono donut__v">{v}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ── small UI ────────────────────────────────────────────────────────────────
function StatCell({ n, label, sub }) {
  return (
    <div className="stat">
      <div className="stat__n mono">{n}</div>
      <div className="stat__l">{label}</div>
      {sub && <div className="stat__sub">{sub}</div>}
    </div>
  );
}

function QuickAction({ label, sub, onClick, kbd }) {
  return (
    <button className="qa" onClick={onClick}>
      <div className="qa__main">
        <div className="qa__lbl">{label}</div>
        {sub && <div className="qa__sub">{sub}</div>}
      </div>
      <span className="qa__arrow mono">→</span>
    </button>
  );
}

function MiniRecordRow({ rec, onOpen, right }) {
  return (
    <li className="minirow" onClick={() => onOpen && onOpen(rec)}>
      <div className="minirow__sleeve">
        <CoverArt artist={rec.artist} album={rec.album} size={40} coverUrl={rec.cover_url} />
      </div>
      <div className="minirow__meta">
        <div className="minirow__a">{rec.artist}</div>
        <div className="minirow__b">{rec.album}</div>
      </div>
      {right && <div className="minirow__right">{right}</div>}
    </li>
  );
}

// ── Dashboard ──────────────────────────────────────────────────────────────
function Dashboard({ records, loans, wishlist, go, onOpen }) {
  const stats = useMemo_db(() => {
    const genres = new Set(records.map((r) => r.genre)).size;
    const artists = new Set(records.map((r) => r.artist)).size;
    const labels = new Set(records.map((r) => r.label)).size;
    return { total: records.length, genres, artists, labels };
  }, [records]);

  const recent = useMemo_db(() => {
    // ids are uuids now, not sequential ints -- can't sort by id.
    // `acquired` (YYYY-MM) comes from when the row was added to
    // Supabase, which is a proxy for "recently added here," not
    // necessarily when you actually bought it.
    return [...records].sort((a, b) => (b.acquiredAt || b.acquired || "").localeCompare(a.acquiredAt || a.acquired || "")).slice(0, 5);
  }, [records]);

  const topGenres = useMemo_db(() => {
    const m = {};
    records.forEach((r) => { m[r.genre] = (m[r.genre] || 0) + 1; });
    return Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([label, value]) => ({ label, value }));
  }, [records]);

  const topLabels = useMemo_db(() => {
    const m = {};
    records.forEach((r) => { m[r.label] = (m[r.label] || 0) + 1; });
    return Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([label, value]) => ({ label, value }));
  }, [records]);

  return (
    <div className="dash">
      {/* ── At-a-glance stats ───────────────────────────────────────── */}
      {/* "On loan" removed for now -- loans aren't backed by real
          storage yet (see FEATURE_IDEAS.md). */}
      <section className="dash__stats">
        <StatCell n={stats.total} label="Records" />
        <StatCell n={stats.genres} label="Genres" />
        <StatCell n={stats.artists} label="Artists" />
        <StatCell n={stats.labels} label="Labels" />
        <StatCell n={wishlist.length} label="Wishlist" />
      </section>

      {/* ── Quick actions ───────────────────────────────────────────── */}
      <section className="dash__qa">
        <QuickAction label="Add a record" sub="Manual entry" onClick={() => go("/admin/add")} />
        <QuickAction label="Edit wishlist" sub={`${wishlist.length} items tracked`} onClick={() => go("/admin/wishlist")} />
      </section>

      {/* ── Recent additions ─────────────────────────────────────────── */}
      <section className="dash__split">
        <div className="admincard">
          <header className="admincard__hd">
            <h3>Recent additions</h3>
            <button className="btn btn--ghost btn--small" onClick={() => go("/")}>View all →</button>
          </header>
          <ul className="minirows">
            {recent.map((r) => (
              <MiniRecordRow key={r.id} rec={r} onOpen={onOpen} />
            ))}
          </ul>
        </div>
      </section>

      {/* ── Infographics row ────────────────────────────────────────── */}
      <section className="dash__viz">
        <div className="admincard">
          <header className="admincard__hd"><h3>Top genres</h3></header>
          <div className="cardbody"><BarList rows={topGenres} /></div>
        </div>
        <div className="admincard">
          <header className="admincard__hd"><h3>Top labels</h3></header>
          <div className="cardbody"><BarList rows={topLabels} accent /></div>
        </div>
        <div className="admincard">
          <header className="admincard__hd"><h3>Format mix</h3></header>
          <div className="cardbody cardbody--center"><FormatDonut records={records} /></div>
        </div>
      </section>

      <section className="admincard">
        <header className="admincard__hd">
          <h3>Acquisitions by year</h3>
          <span className="muted small">When records joined the collection</span>
        </header>
        <div className="cardbody">
          <YearChart records={records} />
        </div>
      </section>
    </div>
  );
}

window.Dashboard = Dashboard;

// admin.jsx — owner-only views: dashboard, add new, wishlist, loans

const { useState: useState_a } = React;

// ── Add New form ────────────────────────────────────────────────────────────
// The old prototype had a "Discogs / Barcode" tab that faked a lookup with
// four hardcoded random albums. Shipping that for real would just be
// misleading -- so it's gone. Real barcode-scan-to-Discogs is on the
// feature list (FEATURE_IDEAS.md) since it needs a camera-scanning
// library, not just a UI tab.
function AddNew({ onAdd }) {
  const [form, setForm] = useState_a({
    artist: "", album: "", genre: "", format: "LP", label: "", notes: "",
  });
  const [flash, setFlash] = useState_a("");
  const [saving, setSaving] = useState_a(false);
  const [err, setErr] = useState_a("");

  function set(k, v) { setForm((f) => ({ ...f, [k]: v })); }

  async function submit(e) {
    e.preventDefault();
    if (!form.artist || !form.album || saving) return;
    setSaving(true);
    setErr("");
    try {
      await onAdd(form);
      setFlash(`Added "${form.album}" to the collection.`);
      setForm({ artist: "", album: "", genre: "", format: "LP", label: "", notes: "" });
      setTimeout(() => setFlash(""), 3500);
    } catch (e2) {
      setErr("Couldn't save that -- check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="admincard">
      <header className="admincard__hd">
        <h3>Add a record</h3>
      </header>

      <form className="form" onSubmit={submit}>
        <div className="form__grid">
          <label><span>Artist</span><input className="input" required value={form.artist} onChange={(e)=>set("artist",e.target.value)} /></label>
          <label><span>Album</span><input className="input" required value={form.album} onChange={(e)=>set("album",e.target.value)} /></label>
          <label><span>Genre</span>
            <input className="input" list="genrelist" value={form.genre} onChange={(e)=>set("genre",e.target.value)} />
            <datalist id="genrelist">
              {["Alternative/Indie","Blues","Classical","Electronic","Folk","Funk","Hip Hop","Jazz","Pop","R&B/Soul","Reggae","Rock","Salsa/Tropical","Soundtrack"].map((g)=> <option key={g} value={g} />)}
            </datalist>
          </label>
          <label><span>Format</span>
            <select className="input" value={form.format} onChange={(e)=>set("format",e.target.value)}>
              <option>LP</option><option>EP</option><option>Single</option><option>12"</option><option>Box Set</option>
            </select>
          </label>
          <label className="span2"><span>Label</span><input className="input" value={form.label} onChange={(e)=>set("label",e.target.value)} /></label>
          <label className="span2"><span>Notes</span><input className="input" placeholder="Where bought, edition, gift from…" value={form.notes} onChange={(e)=>set("notes",e.target.value)} /></label>
        </div>
        <div className="form__actions">
          {flash && <span className="flash">✓ {flash}</span>}
          {err && <span className="flash" style={{ color: "var(--accent)" }}>{err}</span>}
          <div className="grow" />
          <button type="submit" className="btn btn--solid" disabled={saving}>{saving ? "Saving…" : "Add to collection"}</button>
        </div>
      </form>
    </section>
  );
}

// ── Wishlist ────────────────────────────────────────────────────────────────
const GENRE_OPTIONS = ["Alternative/Indie","Blues","Classical","Electronic","Folk","Funk","Hip Hop","Jazz","Pop","R&B/Soul","Reggae","Rock","Salsa/Tropical","Soundtrack"];

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
  const recent = [...records].sort((a, b) => (b.acquired || "").localeCompare(a.acquired || ""))[0];

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

window.AddNew = AddNew;
window.WishlistView = WishlistView;
window.LoansView = LoansView;
window.Stats = Stats;
window.AdminGate = AdminGate;

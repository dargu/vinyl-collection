// sessions.jsx — public Sessions page (past V&G nights) + owner admin for
// logging sessions and recording who brought what.
//
// Design note: "who brought it" is not stored on the play -- it's just
// the record's `owner` column (see ../app/sessions_ownership_migration.sql).
// A record can belong to any of the six people below; the Collection page
// filters to owner === "Diego", but Sessions works across all of them.
// Album clicks reuse the exact same <Detail> component as the Collection
// page (passed in as onOpen) -- there's no separate "session album detail"
// view to keep in sync.

const { useState: useState_s } = React;

const PEOPLE = ["Diego", "Charlie", "Ysita", "Roy", "Joul", "Other"];

function fmtFullDate(s) {
  if (!s) return "—";
  const [y, m, d] = s.split("-");
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${months[parseInt(m, 10) - 1]} ${parseInt(d, 10)}, ${y}`;
}

// ── shared bits ──────────────────────────────────────────────────────────

function PersonSelect({ value, onChange, otherValue, onOtherChange, placeholder }) {
  return (
    <>
      <select className="input" value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">{placeholder || "Select…"}</option>
        {PEOPLE.map((p) => <option key={p} value={p}>{p}</option>)}
      </select>
      {value === "Other" && (
        <input
          className="input"
          placeholder="Name / venue"
          value={otherValue}
          onChange={(e) => onOtherChange(e.target.value)}
          style={{ marginTop: 6 }}
        />
      )}
    </>
  );
}

function AttendeePicker({ selected, onToggle, otherValue, onOtherChange }) {
  return (
    <>
      <div className="attendee-pills">
        {PEOPLE.map((p) => (
          <button
            type="button"
            key={p}
            className={"pill" + (selected.includes(p) ? " pill--on" : "")}
            onClick={() => onToggle(p)}
          >
            {p}
          </button>
        ))}
      </div>
      {selected.includes("Other") && (
        <input
          className="input"
          placeholder="Guest name(s)"
          value={otherValue}
          onChange={(e) => onOtherChange(e.target.value)}
          style={{ marginTop: 8 }}
        />
      )}
    </>
  );
}

// Pick an album from records that already exist, rather than typing it.
//
// WHY: the old free-text version created a brand new record whenever what
// you typed didn't exactly match something already stored. "Sorrow Tears
// and Blood" vs "Sorrow, Tears & Blood" produced two rows for one album.
// Choosing from the list makes that impossible -- a typo can't invent a
// record if typing isn't how you choose one.
//
// Anything genuinely new goes through "Not in the collection yet — add it",
// which opens the same Discogs flow the Collection page uses, so a friend's
// record arrives with cover art and a tracklist rather than as a stub.
function RecordPicker({ records, row, onPick }) {
  const [q, setQ] = useState_s("");
  const [open, setOpen] = useState_s(false);

  const term = q.trim().toLowerCase();
  const matches = !term ? [] : records
    .filter((r) => (r.artist + " " + r.album).toLowerCase().includes(term))
    .slice(0, 8);

  if (row.recordId) {
    const picked = records.find((r) => r.id === row.recordId);
    return (
      <div className="pickedrec">
        {picked && picked.cover_url
          ? <img className="pickedrec__art" src={picked.cover_url} alt="" />
          : <div className="pickedrec__art pickedrec__art--none" />}
        <div className="pickedrec__body">
          <div className="pickedrec__title">{row.title}</div>
          <div className="pickedrec__sub muted small">{row.artist} <span className="dot">·</span> {row.owner}</div>
        </div>
        <button type="button" className="albumrow__x" title="Choose a different album"
          onClick={() => { onPick({ recordId: null, artist: "", title: "", owner: "" }); setQ(""); }}>×</button>
      </div>
    );
  }

  return (
    <div className="recpicker">
      <input
        className="input"
        placeholder="Search the collection…"
        value={q}
        onChange={(e) => { setQ(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
      />
      {open && matches.length > 0 && (
        <ul className="recpicker__list">
          {matches.map((r) => (
            <li key={r.id}>
              <button type="button" className="recpicker__opt" onClick={() => {
                onPick({ recordId: r.id, artist: r.artist, title: r.album, owner: r.owner || "Diego" });
                setQ(""); setOpen(false);
              }}>
                {r.cover_url
                  ? <img className="recpicker__art" src={r.cover_url} alt="" loading="lazy" />
                  : <div className="recpicker__art recpicker__art--none" />}
                <span className="recpicker__txt">
                  <span className="recpicker__title">{r.album}</span>
                  <span className="recpicker__sub muted small">{r.artist} <span className="dot">·</span> {r.owner || "Diego"}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {open && term && matches.length === 0 && (
        <div className="recpicker__none muted small">Nothing matches “{q}”.</div>
      )}
    </div>
  );
}

function AlbumRow({ row, onChange, onRemove, removable, records, onAddRecord }) {
  function set(k, v) { onChange({ ...row, [k]: v }); }
  const [adding, setAdding] = useState_s(false);

  return (
    <div className="albumrow albumrow--picking">
      <div className="albumrow__pick">
        <RecordPicker
          records={records || []}
          row={row}
          onPick={(fields) => onChange({ ...row, ...fields })}
        />
      </div>

      <input className="input" placeholder="Notes (optional)" value={row.notes} onChange={(e) => set("notes", e.target.value)} />
      {removable && <button type="button" className="albumrow__x" onClick={onRemove} title="Remove this album">×</button>}

      {!row.recordId && onAddRecord && (
        <div className="albumrow__toggle">
          <button type="button" className="btn btn--xs btn--ghost" onClick={() => setAdding(true)}>
            Not in the collection yet — add it
          </button>
        </div>
      )}

      {/* Same Discogs flow as the Collection's "Add a record", so an album a
          friend brought lands with cover art and a tracklist rather than as
          a bare artist/title stub. Once saved it's selected into this row. */}
      {adding && (
        <Modal title="Add a record" onClose={() => setAdding(false)}>
          <p className="addrec__lede" style={{ padding: "0 20px" }}>
            Set <strong>Owner</strong> on the next screen to whoever brought it — that's stored on the record itself, not just on this session.
          </p>
          {window.AddRecordFlow ? (
            <window.AddRecordFlow
              onAdd={onAddRecord}
              onSaved={(rec) => {
                onChange({ ...row, recordId: rec.id, artist: rec.artist, title: rec.album, owner: rec.owner || "Diego" });
                setAdding(false);
              }}
            />
          ) : (
            <p className="muted small">The add-record form didn't load. Try reloading the page.</p>
          )}
        </Modal>
      )}
    </div>
  );
}

function emptyAlbumRow() {
  return { recordId: null, artist: "", title: "", owner: "", notes: "" };
}

// Every row now points at a real record -- either one picked from the
// collection, or one just created through the Discogs flow. There's no
// longer a way to half-fill a row with loose text.
function rowFilled(row) { return !!row.recordId; }

function rowToPlay(row) {
  return {
    recordId: row.recordId,
    artist: row.artist,
    title: row.title,
    owner: row.owner || "Diego",
    notes: (row.notes || "").trim() || null,
  };
}

function AddPlayInline({ onAdd, onCancel, records, onAddRecord }) {
  const [row, setRow] = useState_s(emptyAlbumRow());
  const [saving, setSaving] = useState_s(false);
  async function submit() {
    if (!rowFilled(row) || saving) return;
    setSaving(true);
    try {
      await onAdd(rowToPlay(row));
    } finally {
      setSaving(false);
    }
  }
  return (
    <div className="sessionrow__addform">
      <AlbumRow row={row} onChange={setRow} records={records} onAddRecord={onAddRecord} />
      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
        <button className="btn btn--xs btn--solid" disabled={saving} onClick={submit}>{saving ? "Adding…" : "Add"}</button>
        <button className="btn btn--xs btn--ghost" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}

// ── public: list of past sessions ───────────────────────────────────────

function SessionsPage({ sessions, records, onOpen, ribbon, isOwner, go }) {
  const [q, setQ] = useState_s("");
  const [loc, setLoc] = useState_s("All");
  const [sort, setSort] = useState_s("new");
  const [openId, setOpenId] = useState_s(null);

  const recById = React.useMemo(() => Object.fromEntries(records.map((r) => [r.id, r])), [records]);
  const locations = React.useMemo(() => {
    const set = new Set();
    sessions.forEach((s) => { if (s.location) set.add(s.location); });
    return ["All", ...Array.from(set).sort()];
  }, [sessions]);

  const filtered = React.useMemo(() => {
    const ql = q.trim().toLowerCase();
    let rows = sessions.filter((s) => {
      if (loc !== "All" && s.location !== loc) return false;
      if (ql) {
        const hit = s.plays.some((p) => {
          const r = recById[p.recordId];
          return r && `${r.artist} ${r.album}`.toLowerCase().includes(ql);
        });
        if (!hit) return false;
      }
      return true;
    });
    rows = rows.slice().sort((a, b) => (sort === "new" ? (b.date || "").localeCompare(a.date || "") : (a.date || "").localeCompare(b.date || "")));
    return rows;
  }, [sessions, q, loc, sort, recById]);

  return (
    <>
      <header className="page-h">
        <div>
          <h1 className="page-h__title">Sessions</h1>
          <div className="page-h__sub">{sessions.length} {sessions.length === 1 ? "NIGHT" : "NIGHTS"} · VINILES &amp; GALLETAS</div>
        </div>
        <div className="page-h__right">
          {!isOwner && <button className="btn" onClick={() => go("/admin")}>Owner sign-in →</button>}
        </div>
      </header>
      {ribbon}

      <div className="sessions-filterbar">
        <input className="input sessions-filterbar__search" placeholder="Search album or artist…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="input" value={loc} onChange={(e) => setLoc(e.target.value)}>
          {locations.map((l) => <option key={l} value={l}>{l}</option>)}
        </select>
        <select className="input" value={sort} onChange={(e) => setSort(e.target.value)}>
          <option value="new">Newest first</option>
          <option value="old">Oldest first</option>
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="empty"><div className="empty__title">No sessions match those filters.</div></div>
      ) : (
        <div className="sessions-table">
          <div className="sessions-thead">
            <div className="sessions-col-date">Date</div>
            <div className="sessions-col-loc">Location</div>
            <div className="sessions-col-albums">Albums played</div>
          </div>
          {filtered.map((s) => {
            const plays = s.plays.map((p) => ({ ...p, rec: recById[p.recordId] })).filter((p) => p.rec);
            const open = openId === s.id;
            return (
              <div className="sessions-row-wrap" key={s.id}>
                <div className="sessions-row" onClick={() => setOpenId(open ? null : s.id)}>
                  <div className="sessions-col-date mono">{fmtFullDate(s.date)}</div>
                  <div className="sessions-col-loc muted">{s.location || "—"}</div>
                  <div className="sessions-col-albums">
                    <div className="sessions-thumbs">
                      {plays.slice(0, 5).map((p) => (
                        <div className="sessions-thumb" key={p.playId}>
                          <CoverArt artist={p.rec.artist} album={p.rec.album} size={32} coverUrl={p.rec.cover_url} />
                        </div>
                      ))}
                      <span className="muted small">{plays.length} played</span>
                    </div>
                  </div>
                </div>
                {open && (
                  <div className="sessions-detail">
                    <div className="section-h">Albums played</div>
                    <div className="sessions-albumgrid">
                      {plays.map((p) => (
                        <button key={p.playId} className="sessions-albumtile" onClick={() => onOpen(p.rec)}>
                          <div className="sessions-albumtile__cover">
                            <CoverArt artist={p.rec.artist} album={p.rec.album} size={90} coverUrl={p.rec.cover_url} />
                          </div>
                          <div className="sessions-albumtile__meta">
                            <div className="sessions-albumtile__album">{p.rec.album}</div>
                            <div className="sessions-albumtile__artist muted">{p.rec.artist}</div>
                            <div className="sessions-albumtile__by">brought by {p.rec.owner}</div>
                          </div>
                        </button>
                      ))}
                    </div>

                    <div className="section-h" style={{ marginTop: 18 }}>Attendees</div>
                    <div className="attendee-pills attendee-pills--static">
                      {(s.attendees || []).map((a) => <span key={a} className="pill">{a}</span>)}
                      {(!s.attendees || s.attendees.length === 0) && <span className="muted small">Not recorded.</span>}
                    </div>

                    {s.notes && (
                      <>
                        <div className="section-h" style={{ marginTop: 18 }}>Notes</div>
                        <p className="review__text" style={{ margin: 0 }}>{s.notes}</p>
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

// ── owner: log sessions + record what got played ───────────────────────

function SessionForm({ initial, onCancel, onSave, saving, records, onAddRecord }) {
  const [date, setDate] = useState_s(initial.date || new Date().toISOString().slice(0, 10));
  const [locSel, setLocSel] = useState_s(PEOPLE.includes(initial.locationPerson) ? initial.locationPerson : (initial.location ? "Other" : ""));
  const [locOther, setLocOther] = useState_s(initial.locationOther || (initial.location && !PEOPLE.includes(initial.locationPerson) ? initial.location : ""));
  const [attendees, setAttendees] = useState_s(initial.attendees || []);
  const [attOther, setAttOther] = useState_s(initial.attendeesOther || "");
  const [notes, setNotes] = useState_s(initial.notes || "");
  const [albums, setAlbums] = useState_s(initial.albums || [emptyAlbumRow(), emptyAlbumRow()]);

  function toggleAttendee(p) {
    setAttendees((xs) => (xs.includes(p) ? xs.filter((x) => x !== p) : [...xs, p]));
  }
  function setAlbum(i, row) { setAlbums((xs) => xs.map((x, idx) => (idx === i ? row : x))); }
  function removeAlbum(i) { setAlbums((xs) => xs.filter((_, idx) => idx !== i)); }
  function addAlbum() { setAlbums((xs) => [...xs, emptyAlbumRow()]); }

  function locationValue() {
    if (!locSel) return "";
    if (locSel === "Other") return locOther ? `Other — ${locOther}` : "Other";
    return `${locSel}'s`;
  }
  function attendeesValue() {
    const list = attendees.filter((a) => a !== "Other");
    if (attendees.includes("Other") && attOther.trim()) list.push(attOther.trim());
    return list;
  }

  function submit(e) {
    e.preventDefault();
    if (!date) return;
    const cleanAlbums = albums.filter(rowFilled).map(rowToPlay);
    onSave({ date, location: locationValue(), attendees: attendeesValue(), notes: notes.trim() || null, albums: cleanAlbums });
  }

  return (
    <form onSubmit={submit}>
      <div className="form__grid">
        <label><span>Date</span><input className="input" type="date" required value={date} onChange={(e) => setDate(e.target.value)} /></label>
        <label>
          <span>Location</span>
          <PersonSelect value={locSel} onChange={setLocSel} otherValue={locOther} onOtherChange={setLocOther} placeholder="Whose place…" />
        </label>
      </div>

      <div style={{ marginTop: 16 }}>
        <span className="section-h">Attendees</span>
        <AttendeePicker selected={attendees} onToggle={toggleAttendee} otherValue={attOther} onOtherChange={setAttOther} />
      </div>

      {!initial.hideAlbums && (
        <div style={{ marginTop: 18 }}>
          <span className="section-h">Albums played</span>
          <div className="albumrows">
            {albums.map((row, i) => (
              <AlbumRow key={i} row={row} onChange={(r) => setAlbum(i, r)} onRemove={() => removeAlbum(i)} removable={albums.length > 1} records={records} onAddRecord={onAddRecord} />
            ))}
          </div>
          <button type="button" className="btn btn--ghost btn--xs" onClick={addAlbum}>+1 album</button>
        </div>
      )}

      <div style={{ marginTop: 18 }}>
        <span className="section-h">Session notes</span>
        <textarea className="input" rows={2} placeholder="Anything worth remembering about the night…" value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>

      <div className="form__actions" style={{ marginTop: 18 }}>
        <div className="grow" />
        <button type="button" className="btn btn--ghost" onClick={onCancel}>Cancel</button>
        <button type="submit" className="btn btn--solid" disabled={saving}>{saving ? "Saving…" : "Log session"}</button>
      </div>
    </form>
  );
}

function Modal({ onClose, children, title }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-card__hd">
          <h3>{title}</h3>
          <button className="iconbtn" onClick={onClose} aria-label="Close">×</button>
        </div>
        <div className="modal-card__body">{children}</div>
      </div>
    </div>
  );
}

function SessionsAdmin({ sessions, records, onAddSession, onUpdateSession, onAddPlay, onRemovePlay, onDeleteSession, onAddRecord }) {
  const [adding, setAdding] = useState_s(false);
  const [editingId, setEditingId] = useState_s(null);
  const [addingPlayTo, setAddingPlayTo] = useState_s(null);
  const [saving, setSaving] = useState_s(false);

  const recById = React.useMemo(() => Object.fromEntries(records.map((r) => [r.id, r])), [records]);

  async function handleAddSession(fields) {
    setSaving(true);
    try {
      await onAddSession(fields);
      setAdding(false);
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdateSession(id, fields) {
    setSaving(true);
    try {
      await onUpdateSession(id, { date: fields.date, location: fields.location, attendees: fields.attendees, notes: fields.notes });
      setEditingId(null);
    } finally {
      setSaving(false);
    }
  }

  const editingSession = sessions.find((s) => s.id === editingId);

  return (
    <>
      <section className="admincard">
        <header className="admincard__hd">
          <h3>Sessions <span className="muted small">— {sessions.length}</span></h3>
          <button className="btn btn--solid btn--small" onClick={() => setAdding(true)}>+ Add session</button>
        </header>

        <ul className="sessionslist">
          {sessions.length === 0 && (
            <li><div className="cardbody"><div className="muted small">No sessions logged yet — add the first one above.</div></div></li>
          )}
          {sessions.map((s) => {
            const plays = s.plays.map((p) => ({ ...p, rec: recById[p.recordId] })).filter((p) => p.rec);
            return (
              <li key={s.id} className="sessionrow">
                <div className="sessionrow__hd">
                  <div>
                    <div className="sessionrow__date mono">{fmtFullDate(s.date)}</div>
                    {s.location && <div className="sessionrow__loc">{s.location}</div>}
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button className="btn btn--xs btn--ghost" onClick={() => setEditingId(s.id)}>Edit</button>
                    <button className="btn btn--xs btn--ghost" onClick={() => onDeleteSession(s.id)}>Delete</button>
                  </div>
                </div>
                {s.attendees && s.attendees.length > 0 && (
                  <div className="attendee-pills attendee-pills--static">
                    {s.attendees.map((a) => <span key={a} className="pill pill--sm">{a}</span>)}
                  </div>
                )}
                {s.notes && <div className="sessionrow__notes">{s.notes}</div>}

                <div className="sessionrow__plays">
                  {plays.length === 0 && <span className="muted small">Nothing played yet.</span>}
                  {plays.map((p) => (
                    <span key={p.playId} className="playchip">
                      {p.rec.artist} — {p.rec.album} <span className="muted">({p.rec.owner})</span>
                      <button onClick={() => onRemovePlay(p.playId)} title="Remove">×</button>
                    </span>
                  ))}
                </div>

                <div className="sessionrow__add">
                  {addingPlayTo === s.id ? (
                    <AddPlayInline
                      records={records}
                      onAddRecord={onAddRecord}
                      onAdd={async (fields) => { await onAddPlay(s.id, fields); setAddingPlayTo(null); }}
                      onCancel={() => setAddingPlayTo(null)}
                    />
                  ) : (
                    <button className="btn btn--xs btn--ghost" onClick={() => setAddingPlayTo(s.id)}>+ Add record played</button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      {adding && (
        <Modal title="Add session" onClose={() => setAdding(false)}>
          <SessionForm initial={{}} onCancel={() => setAdding(false)} onSave={handleAddSession} saving={saving} records={records} onAddRecord={onAddRecord} />
        </Modal>
      )}

      {editingSession && (
        <Modal title="Edit session" onClose={() => setEditingId(null)}>
          <SessionForm
            initial={{
              date: editingSession.date,
              location: editingSession.location,
              locationPerson: PEOPLE.find((p) => editingSession.location === `${p}'s`) || (editingSession.location && editingSession.location.startsWith("Other") ? "Other" : ""),
              locationOther: editingSession.location && editingSession.location.startsWith("Other — ") ? editingSession.location.replace("Other — ", "") : "",
              attendees: (editingSession.attendees || []).filter((a) => PEOPLE.includes(a)),
              attendeesOther: (editingSession.attendees || []).filter((a) => !PEOPLE.includes(a)).join(", "),
              notes: editingSession.notes,
              hideAlbums: true,
            }}
            onCancel={() => setEditingId(null)}
            onSave={(fields) => handleUpdateSession(editingSession.id, fields)}
            saving={saving}
          />
        </Modal>
      )}
    </>
  );
}

window.SessionsPage = SessionsPage;
window.SessionsAdmin = SessionsAdmin;
window.fmtFullDate = fmtFullDate;

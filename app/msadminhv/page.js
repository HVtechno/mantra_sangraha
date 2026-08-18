'use client';
// app/msadminhv/page.js  (served at /msadminhv — deliberately unguessable)
// Private admin dashboard — NOT linked anywhere and NOT a login. Open /msadminhv,
// paste your ADMIN_TOKEN once (held in this browser tab only). Lists mantra
// requests + feedback, lets you archive/restore/delete, and auto-archives
// feedback older than 30 days.
import { useState, useEffect, useCallback } from 'react';

const KEY_STORE = 'ms-admin-key';

function timeAgo(ts) {
  const s = Math.max(1, Math.floor((Date.now() - ts) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60); if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60); if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24); return `${d}d ago`;
}

export default function Admin() {
  const [key, setKey] = useState('');
  const [entered, setEntered] = useState(false);
  const [ready, setReady] = useState(false);
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState('');            // id currently being acted on
  const [filter, setFilter] = useState('all');     // all | mantra | feedback
  const [view, setView] = useState('active');      // active | archive

  useEffect(() => { try { const k = sessionStorage.getItem(KEY_STORE); if (k) { setKey(k); setEntered(true); } } catch {} setReady(true); }, []);

  const load = useCallback(async (k, v) => {
    setLoading(true); setErr('');
    try {
      const r = await fetch(`/api/admin/feedback?view=${v}`, { headers: { 'x-admin-token': k } });
      const j = await r.json();
      if (j.ok) { setData(j); try { sessionStorage.setItem(KEY_STORE, k); } catch {} }
      else if (j.error === 'unauthorized') { setErr('Wrong key.'); setEntered(false); try { sessionStorage.removeItem(KEY_STORE); } catch {} }
      else if (j.error === 'not_configured') setErr('ADMIN_TOKEN is not set on the server yet.');
      else setErr(j.message || 'Could not load.');
    } catch (e) { setErr(String(e.message || e)); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { if (entered && key) load(key, view); }, [entered, key, view, load]);

  const act = async (id, action, area) => {
    if (action === 'delete' && !window.confirm('Delete this permanently?')) return;
    setBusy(id);
    try {
      await fetch('/api/admin/feedback', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-admin-token': key }, body: JSON.stringify({ id, action, area }) });
      await load(key, view);
    } catch {}
    finally { setBusy(''); }
  };

  if (!ready) return <div className="admin-wrap" />;

  if (!entered) {
    return (
      <div className="admin-wrap">
        <div className="admin-gate">
          <h1>ॐ Admin</h1>
          <p>Enter your admin key to view requests &amp; feedback.</p>
          <input type="password" value={key} placeholder="Admin key" onChange={(e) => setKey(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && key) setEntered(true); }} />
          <button className="btn" disabled={!key} onClick={() => setEntered(true)}>Open dashboard</button>
          {err && <div className="admin-err">{err}</div>}
        </div>
      </div>
    );
  }

  const items = (data && data.items) || [];
  const shown = filter === 'all' ? items : items.filter((x) => x.kind === filter);
  const c = (data && data.counts) || { active: 0, archive: 0, mantra: 0, feedback: 0 };
  const rated = items.filter((x) => x.rating > 0);
  const avg = rated.length ? (rated.reduce((s, x) => s + x.rating, 0) / rated.length) : 0;
  const isArchive = view === 'archive';

  return (
    <div className="admin-wrap">
      <div className="admin-head">
        <h1>ॐ Requests &amp; Feedback</h1>
        <div className="admin-actions">
          <button className="btn ghost small" onClick={() => load(key, view)} disabled={loading}>{loading ? 'Refreshing…' : 'Refresh'}</button>
          <button className="btn ghost small" onClick={() => { try { sessionStorage.removeItem(KEY_STORE); } catch {}; setEntered(false); setData(null); }}>Lock</button>
        </div>
      </div>

      {err && <div className="admin-err">{err}</div>}

      <div className="admin-viewtabs">
        <button className={view === 'active' ? 'on' : ''} onClick={() => setView('active')}>Active · {c.active}</button>
        <button className={view === 'archive' ? 'on' : ''} onClick={() => setView('archive')}>Archived · {c.archive}</button>
      </div>

      <div className="admin-stats">
        <button className={`stat ${filter === 'all' ? 'on' : ''}`} onClick={() => setFilter('all')}><b>{items.length}</b><span>shown</span></button>
        <button className={`stat ${filter === 'mantra' ? 'on' : ''}`} onClick={() => setFilter('mantra')}><b>{c.mantra}</b><span>mantra requests</span></button>
        <button className={`stat ${filter === 'feedback' ? 'on' : ''}`} onClick={() => setFilter('feedback')}><b>{c.feedback}</b><span>feedback</span></button>
        {rated.length ? <div className="stat rating"><b>{avg.toFixed(1)}★</b><span>avg · {rated.length} rated</span></div> : null}
        {data && <span className="admin-backend">store: {data.backend}</span>}
      </div>

      {!shown.length && !loading && <div className="admin-empty">{isArchive ? 'Archive is empty.' : 'Nothing here yet.'}</div>}

      <div className="admin-list">
        {shown.map((x) => (
          <div key={x.id} className={`admin-card ${x.kind}`}>
            <div className="admin-card-top">
              <span className={`tag ${x.kind}`}>{x.kind === 'mantra' ? 'Mantra request' : 'Feedback'}</span>
              {x.rating > 0 && <span className="admin-stars" title={`${x.rating}/5`}>{'★'.repeat(x.rating)}<span className="dim">{'★'.repeat(5 - x.rating)}</span></span>}
              <span className="admin-when">{timeAgo(x.ts)}</span>
            </div>
            <div className="admin-text">{x.text}</div>
            <div className="admin-meta">
              {x.contact ? <span title="contact">✉ {x.contact}</span> : null}
              {x.lang ? <span>lang: {x.lang}</span> : null}
              {x.version ? <span>v{x.version}</span> : null}
              <span title="anonymous device id">#{x.client || '—'}</span>
              <span className="admin-rowbtns">
                {isArchive
                  ? <button className="rowbtn" disabled={busy === x.id} onClick={() => act(x.id, 'restore')}>Restore</button>
                  : <button className="rowbtn" disabled={busy === x.id} onClick={() => act(x.id, 'archive')} title="Move to archive (e.g. once you've added it)">Archive</button>}
                <button className="rowbtn danger" disabled={busy === x.id} onClick={() => act(x.id, 'delete', view)}>Delete</button>
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

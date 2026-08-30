// app/api/admin/feedback/route.js
// Admin-only. Gated by the shared ADMIN_TOKEN secret (x-admin-token header) —
// not a login. GET lists submissions (active or ?view=archive) and auto-archives
// feedback older than 30 days. POST performs archive / restore / delete.
import { listFeedback, archiveItem, restoreItem, deleteItem, pruneOldFeedback, backend, counts, getStats, resetStats } from '@/lib/feedbackStore';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const RETENTION_DAYS = 30;

function auth(request) {
  const expected = process.env.ADMIN_TOKEN || '';
  if (!expected) return { error: 'not_configured', status: 503, message: 'Set ADMIN_TOKEN in the server environment.' };
  const given = request.headers.get('x-admin-token') || new URL(request.url).searchParams.get('key') || '';
  if (given !== expected) return { error: 'unauthorized', status: 401 };
  return null;
}

export async function GET(request) {
  const bad = auth(request);
  if (bad) return Response.json({ ok: false, error: bad.error, message: bad.message }, { status: bad.status });

  const view = new URL(request.url).searchParams.get('view') === 'archive' ? 'archive' : 'active';
  try {
    // Self-maintaining retention: sweep old feedback into the archive on view.
    let pruned = 0;
    try { pruned = await pruneOldFeedback(RETENTION_DAYS); } catch {}
    const items = await listFeedback(view === 'archive' ? 3000 : 500, view);
    const c = await counts();
    let stats = null;
    try { stats = await getStats(); } catch {}
    return Response.json({
      ok: true, view, backend: backend(), pruned, stats,
      counts: {
        active: c.active, archive: c.archive,
        mantra: items.filter((x) => x.kind === 'mantra').length,
        feedback: items.filter((x) => x.kind === 'feedback').length,
      },
      items,
    }, { status: 200, headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    console.error('[admin/feedback] list failed:', (e && e.message) || e);
    return Response.json({ ok: false, error: 'server_error', message: String((e && e.message) || e) }, { status: 500 });
  }
}

export async function POST(request) {
  const bad = auth(request);
  if (bad) return Response.json({ ok: false, error: bad.error, message: bad.message }, { status: bad.status });

  let body = {};
  try { body = await request.json(); } catch { return Response.json({ ok: false, error: 'bad_json' }, { status: 400 }); }
  const id = String((body && body.id) || '').trim();
  const action = String((body && body.action) || '').trim();
  const area = body && body.area === 'archive' ? 'archive' : 'active';

  // Reset the visit/user/seva counters (no id needed). Feedback is untouched.
  if (action === 'reset-stats') {
    try { await resetStats(); return Response.json({ ok: true }, { status: 200 }); }
    catch (e) { console.error('[admin/feedback] reset failed:', (e && e.message) || e); return Response.json({ ok: false, error: 'server_error', message: String((e && e.message) || e) }, { status: 500 }); }
  }

  if (!id || !action) return Response.json({ ok: false, error: 'missing' }, { status: 400 });

  try {
    let done = false;
    if (action === 'archive') done = await archiveItem(id);
    else if (action === 'restore') done = await restoreItem(id);
    else if (action === 'delete') done = await deleteItem(id, area);
    else return Response.json({ ok: false, error: 'bad_action' }, { status: 400 });
    return Response.json({ ok: done }, { status: done ? 200 : 404 });
  } catch (e) {
    console.error('[admin/feedback] action failed:', (e && e.message) || e);
    return Response.json({ ok: false, error: 'server_error', message: String((e && e.message) || e) }, { status: 500 });
  }
}

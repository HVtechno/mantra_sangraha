// app/api/feedback/route.js
// POST a user submission — a mantra request or a piece of feedback. Stored via
// lib/feedbackStore (Upstash in prod, local file in dev). No accounts, no IPs.
import { saveFeedback, backend } from '@/lib/feedbackStore';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request) {
  let body = {};
  try { body = await request.json(); } catch { return Response.json({ ok: false, error: 'bad_json' }, { status: 400 }); }

  // Honeypot: real users never fill this hidden field; bots do. Accept & drop.
  if (body && String(body.website || '').trim()) return Response.json({ ok: true, dropped: true }, { status: 200 });

  const text = String((body && body.text) || '').trim();
  if (!text) return Response.json({ ok: false, error: 'empty' }, { status: 400 });
  if (text.length > 2000) return Response.json({ ok: false, error: 'too_long' }, { status: 400 });

  try {
    const rec = await saveFeedback({
      kind: body.kind,
      text,
      rating: body.rating,
      contact: body.contact,
      lang: body.lang,
      script: body.script,
      version: body.version,
      client: body.client,
    });
    console.log('[feedback] saved via', backend(), '·', rec.kind, '·', rec.id);
    return Response.json({ ok: true, id: rec.id }, { status: 200 });
  } catch (e) {
    console.error('[feedback] save failed:', (e && e.message) || e);
    return Response.json({ ok: false, error: 'server_error', message: String((e && e.message) || e) }, { status: 500 });
  }
}

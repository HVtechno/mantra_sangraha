// app/api/visit/route.js
// Public, write-only. Records one anonymous visit (called once per browser
// session from the client). No IP, no location, no personal data — just a count.
import { bumpVisit } from '@/lib/feedbackStore';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request) {
  let body = {};
  try { body = await request.json(); } catch {}
  try { await bumpVisit(body && body.client); } catch (e) { console.error('[visit] bump failed:', (e && e.message) || e); }
  return Response.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } });
}

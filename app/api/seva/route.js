// app/api/seva/route.js
// Public, write-only. Records that someone tapped an offering amount (interest
// signal) — NOT a confirmed payment. Anonymous aggregate only.
import { bumpSeva } from '@/lib/feedbackStore';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request) {
  let body = {};
  try { body = await request.json(); } catch {}
  try { await bumpSeva(body && body.amount); } catch (e) { console.error('[seva] bump failed:', (e && e.message) || e); }
  return Response.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } });
}

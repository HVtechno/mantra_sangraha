// app/api/mood/route.js
// GET /api/mood?q=<free-text mood>
// Returns real mantras matched to the mood (AI when OPENAI_API_KEY is set,
// keyword fallback otherwise). The mantra text itself is fetched separately from
// the source — this endpoint only recommends.

import { moodSearch } from '@/lib/mood';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q') || searchParams.get('mood') || '';
  if (!q.trim()) return Response.json({ ok: false, error: 'empty' }, { status: 400 });
  try {
    const result = await moodSearch(q);
    return Response.json(result, { status: result.ok ? 200 : 400 });
  } catch (e) {
    return Response.json({ ok: false, error: 'server_error', message: String((e && e.message) || e) }, { status: 500 });
  }
}

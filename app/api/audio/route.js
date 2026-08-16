// app/api/audio/route.js
// GET /api/audio?name=<mantra>   -> search + resolve the best ad-free recitation
// GET /api/audio?item=<archiveId> -> resolve one specific item (for "Try another")
//
// Audio comes from the Internet Archive (public-domain / CC recitations): plain
// MP3s, ad-free by design, legal to stream with attribution, and analysable by
// the browser so karaoke Auto-sync works. Must be server-side (avoids CORS and
// keeps the search off the client).

import { find, findItem } from '@/lib/audioSearch';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const item = (searchParams.get('item') || '').trim();
  const name = (searchParams.get('name') || searchParams.get('q') || '').trim();

  if (!item && !name) {
    return Response.json({ ok: false, error: 'empty', message: 'Pass ?name=<mantra> or ?item=<id>' }, { status: 400 });
  }

  try {
    const result = item ? await findItem(item, name) : await find(name);
    // Always 200 — "no recitation" is a normal result (ok:false), not an HTTP
    // error; returning 404 here just spams the browser console.
    return Response.json(result, {
      status: 200,
      headers: { 'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800' },
    });
  } catch (e) {
    return Response.json({ ok: false, error: 'server_error', message: String((e && e.message) || e) }, { status: 500 });
  }
}

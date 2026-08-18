// app/api/audio/route.js
// GET /api/audio?slug=<mantraId>&name=<mantra>  -> recitation for a mantra
// GET /api/audio?item=<archiveId>&name=<mantra> -> resolve one specific item
//
// Resolution order:
//   1) the PRE-BUILT index (lib/audioIndex.json, keyed by slug) — instant, no
//      network, no live archive.org search → no "temporarily unavailable".
//   2) live archive.org search (lib/audioSearch) as a fallback for anything not
//      in the index yet.
// Playback still streams the mp3 from archive's CDN client-side (reliable); only
// the fragile server-side SEARCH is what the index removes.

import { find, findItem } from '@/lib/audioSearch';
import { getIndexed } from '@/lib/audioIndex';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const item = (searchParams.get('item') || '').trim();
  const slug = (searchParams.get('slug') || '').trim();
  const name = (searchParams.get('name') || searchParams.get('q') || '').trim();

  if (!item && !name && !slug) {
    return Response.json({ ok: false, error: 'empty', message: 'Pass ?slug= / ?name= / ?item=' }, { status: 400 });
  }

  const okHeaders = { 'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800' };

  // 1) Pre-built index (no search) — the reliable fast path.
  if (!item && slug) {
    const feeds = getIndexed(slug);
    if (feeds) {
      const first = feeds[0];
      return Response.json({
        ok: true, url: first.url, title: first.title, sourceUrl: first.sourceUrl, itemId: first.itemId,
        source: 'Internet Archive', indexed: true,
        alternatives: feeds.map((f) => ({ itemId: f.itemId, title: f.title, url: f.url, sourceUrl: f.sourceUrl })),
      }, { status: 200, headers: okHeaders });
    }
  }

  // 2) Live search fallback.
  try {
    const result = item ? await findItem(item, name) : await find(name);
    return Response.json(result, { status: 200, headers: okHeaders });
  } catch (e) {
    return Response.json({ ok: false, error: 'server_error', message: String((e && e.message) || e) }, { status: 500 });
  }
}

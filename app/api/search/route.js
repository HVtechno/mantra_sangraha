// app/api/search/route.js
// GET /api/search?q=<text>
// Suggestions for the search box. Curated catalog first (rich deity/tradition
// metadata + colloquial first-lines), then filled from vignanam's full sitemap
// index so EVERY stotra on the site is discoverable — and every suggestion is a
// real slug that will actually fetch when tapped. The index read is best-effort
// and non-blocking (served from cache; refreshed in the background).

import { suggest } from '@/lib/aliases';
import { suggestFromIndex } from '@/lib/catalog';

export const runtime = 'nodejs';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q') || '';
  const limit = 10;

  const results = [];
  const seen = new Set();

  for (const r of suggest(q, limit)) {
    if (seen.has(r.slug)) continue;
    seen.add(r.slug);
    results.push({ name: r.name, slug: r.slug, deity: r.deity, tradition: r.tradition, source: 'catalog' });
  }

  if (results.length < limit) {
    let indexed = [];
    try { indexed = suggestFromIndex(q, limit * 2); } catch { indexed = []; }
    for (const e of indexed) {
      if (seen.has(e.slug)) continue;
      seen.add(e.slug);
      results.push({ name: e.name, slug: e.slug, deity: null, tradition: null, source: 'index' });
      if (results.length >= limit) break;
    }
  }

  return Response.json({ ok: true, query: q, results });
}

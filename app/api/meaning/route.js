// app/api/meaning/route.js
// GET /api/meaning?mantra=<name>&script=<script>
// Sourced English verse meanings from the source's /meaning/ pages.

import { fetchMeaning } from '@/lib/fetchMantra';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const mantra = searchParams.get('mantra') || searchParams.get('q') || '';
  let script = (searchParams.get('script') || 'devanagari').toLowerCase();
  const ALLOWED = ['devanagari', 'tamil', 'telugu', 'kannada', 'malayalam', 'bengali', 'gujarati', 'odia', 'hindi'];
  if (!ALLOWED.includes(script)) script = 'devanagari';
  if (!mantra.trim()) return Response.json({ ok: false, error: 'empty_query' }, { status: 400 });

  try {
    const result = await fetchMeaning(mantra, script);
    return Response.json(result, {
      status: result.ok ? 200 : 404,
      headers: { 'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800' },
    });
  } catch (e) {
    return Response.json({ ok: false, error: 'server_error', message: String((e && e.message) || e) }, { status: 500 });
  }
}

// app/api/fetch/route.js
// GET /api/fetch?mantra=<name>
// Server-side fetch of clean Devanagari verses from open sources.
// (Must be server-side: the source sites block direct browser/CORS calls.)

import { fetchMantra } from '@/lib/fetchMantra';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const mantra = searchParams.get('mantra') || searchParams.get('q') || '';
  const ALLOWED = ['devanagari', 'tamil', 'telugu', 'kannada', 'malayalam', 'bengali', 'gujarati', 'odia', 'hindi'];
  let script = (searchParams.get('script') || 'devanagari').toLowerCase();
  if (!ALLOWED.includes(script)) script = 'devanagari';

  if (!mantra.trim()) {
    return Response.json(
      { ok: false, error: 'empty_query', message: 'Pass ?mantra=<name>' },
      { status: 400 }
    );
  }

  try {
    const result = await fetchMantra(mantra, script);
    const status = result.ok ? 200 : result.error === 'not_found' ? 404 : 502;
    return Response.json(result, {
      status,
      headers: { 'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400' },
    });
  } catch (e) {
    return Response.json(
      { ok: false, error: 'server_error', message: String((e && e.message) || e) },
      { status: 500 }
    );
  }
}

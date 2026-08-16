// lib/sources/vignanam.js
// Source adapter for Vaidika Vignanam (vignanam.org).
// Clean per-stotra Devanagari pages at:
//   https://www.vignanam.org/devanagari/<slug>.html
//   https://www.vignanam.org/shuddha-devanagari/<slug>.html  (correct anusvaras, when available)

const { parseDocument, parseMeanings } = require('../parse');

// Some stotra sites (Cloudflare etc.) reject unknown User-Agents with a 403.
// Present as a normal browser so the public pages load the same as they would
// in a tab. We only read public-domain text and always attribute the source.
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

const id = 'vignanam';
const label = 'Vaidika Vignanam';
const license = 'Public-domain source text (traditional stotra). Attribution: vignanam.org';

// Try both host variants; some setups redirect / block one form.
const HOSTS = ['https://www.vignanam.org', 'https://vignanam.org'];

function candidateUrls(slug, script = 'devanagari') {
  // Prefer shuddha (correct anusvaras) when available, then the plain script.
  // Cross each script path with each host.
  const paths = [`/shuddha-${script}/${slug}.html`, `/${script}/${slug}.html`];
  const urls = [];
  for (const p of paths) for (const h of HOSTS) urls.push(h + p);
  return urls;
}

async function fetchUrl(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': UA,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9,sa;q=0.8,hi;q=0.7',
      },
      redirect: 'follow',
      signal: controller.signal,
    });
    if (!res.ok) return { ok: false, status: res.status, url };
    const html = await res.text();
    return { ok: true, status: 200, html, url };
  } finally {
    clearTimeout(timer);
  }
}

// The stotra's own title in the page's script (e.g. Tamil "சௌந்தர்ய லஹரீ"),
// taken from the og:title meta so book cards can show the localized name.
function extractTitle(html) {
  const patterns = [
    /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i,
    /<meta[^>]+name=["']og:title["'][^>]+content=["']([^"']+)["']/i,
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (m && m[1]) return m[1].replace(/\s*[|·-]\s*(Vaidika Vignanam|Vignanam).*$/i, '').trim();
  }
  return null;
}

/**
 * Try to fetch + parse a stotra by slug.
 * Returns { ok, name, title, verses, source, sourceUrl, ... } or { ok:false }.
 */
async function fetchBySlug(slug, meta = {}, script = 'devanagari') {
  const urls = candidateUrls(slug, script);
  const tried = [];
  for (const url of urls) {
    let r;
    try {
      r = await fetchUrl(url);
    } catch (e) {
      tried.push({ url, error: String((e && e.name) || e) });
      continue;
    }
    tried.push({ url, status: r.status });
    if (!r.ok) continue;

    const parsed = parseDocument(r.html, script);
    // Require a plausible stotra: at least one numbered verse OR some body text.
    if (parsed.numberedCount >= 1 || parsed.verseCount >= 1) {
      const isShuddha = url.includes('/shuddha-');
      return {
        ok: true,
        slug,
        name: meta.name || null,
        title: extractTitle(r.html),
        tradition: meta.tradition || null,
        deity: meta.deity || null,
        verses: parsed.verses,
        verseCount: parsed.verseCount,
        numberedCount: parsed.numberedCount,
        lastNumber: parsed.lastNumber,
        script: isShuddha ? `shuddha-${script}` : script,
        source: label,
        sourceId: id,
        sourceUrl: url,
        license,
      };
    }
    // 200 but no verses parsed -> record for diagnostics and keep trying.
    tried[tried.length - 1].note = 'fetched but no verses parsed';
  }
  return { ok: false, status: tried.length ? tried[tried.length - 1].status || -1 : 0, slug, sourceId: id, tried };
}

// Sourced meanings from vignanam's /meaning/<script>/<slug>.html pages.
// Returns { ok, meanings:{ "1": "...", ... }, sourceUrl } or { ok:false }.
async function fetchMeaning(slug, meta = {}, script = 'devanagari') {
  const urls = [
    `${HOSTS[0]}/meaning/${script}/${slug}.html`,
    `${HOSTS[1]}/meaning/${script}/${slug}.html`,
    `${HOSTS[0]}/meaning/devanagari/${slug}.html`,
  ];
  const tried = [];
  for (const url of urls) {
    let r;
    try { r = await fetchUrl(url); } catch (e) { tried.push({ url, error: String((e && e.name) || e) }); continue; }
    tried.push({ url, status: r.status });
    if (!r.ok) continue;
    const meanings = parseMeanings(r.html);
    if (meanings && Object.keys(meanings).length) {
      return { ok: true, slug, meanings, source: label, sourceId: id, sourceUrl: url };
    }
    tried[tried.length - 1].note = 'no meanings parsed';
  }
  return { ok: false, sourceId: id, tried };
}

module.exports = { id, label, license, candidateUrls, fetchBySlug, fetchMeaning };

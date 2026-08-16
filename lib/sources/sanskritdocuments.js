// lib/sources/sanskritdocuments.js
// Second source: sanskritdocuments.org — a fallback for when vignanam misses a
// text (or is down).
//
// Honest limitations, by design:
//  1. Its per-text HTML is DEVANAGARI ONLY (other scripts are only PDFs, which we
//     don't parse). So this adapter declines non-devanagari requests and lets
//     vignanam remain the multi-script source.
//  2. Filenames are idiosyncratic (`lingashh`, not `lingashtakam`), so there's no
//     derivable slug — it uses a curated map. Extend SLUG_MAP to add coverage.
//
// The text is public-domain; sanskritdocuments asks that their files be used for
// personal study/research and not reposted for promotion — on-demand fetch into a
// user's own book, with attribution, respects that.

const { parseDocument } = require('../parse');

const id = 'sanskritdocuments';
const label = 'Sanskrit Documents';
const license = 'Public-domain text, volunteer-proofread. Personal study/research. Attribution: sanskritdocuments.org';
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

// canonical slug (our catalog) -> "<folder>/<file>" on sanskritdocuments.org
// Only verified filenames. Add more as they're confirmed (the file is
// <folder>/<name>.html, mirroring <name>.itx on the site).
const SLUG_MAP = {
  'lingashtakam': 'doc_shiva/lingashh',
  'soundarya-lahari': 'doc_devii/saundaryalahari',
  'sri-rudram-namakam': 'doc_shiva/rudram',
  'sri-rudram-chamakam': 'doc_shiva/rudram',
};

function candidateUrls(slug) {
  const path = SLUG_MAP[slug];
  if (!path) return [];
  return [`https://sanskritdocuments.org/${path}.html`];
}

// First Devanagari line is the stotra's own title on these pages.
function extractTitle(text) {
  for (const raw of String(text).split('\n')) {
    const line = raw.trim();
    if (/[ऀ-ॿ]/.test(line) && !/[।॥]/.test(line) && line.length <= 60) return line;
  }
  return null;
}

async function fetchUrl(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': UA, Accept: 'text/html', 'Accept-Language': 'en-US,en;q=0.9,sa;q=0.8' },
      redirect: 'follow', signal: controller.signal,
    });
    if (!res.ok) return { ok: false, status: res.status, url };
    return { ok: true, status: 200, html: await res.text(), url };
  } finally { clearTimeout(timer); }
}

async function fetchBySlug(slug, meta = {}, script = 'devanagari') {
  // Devanagari-only source: don't pretend to serve other scripts.
  if (script !== 'devanagari') return { ok: false, status: 0, sourceId: id, tried: [{ skipped: `no ${script} HTML` }] };
  const urls = candidateUrls(slug);
  if (!urls.length) return { ok: false, status: 0, sourceId: id, tried: [{ note: 'not in slug map' }] };

  const tried = [];
  for (const url of urls) {
    let r;
    try { r = await fetchUrl(url); } catch (e) { tried.push({ url, error: String((e && e.name) || e) }); continue; }
    tried.push({ url, status: r.status });
    if (!r.ok) continue;
    const parsed = parseDocument(r.html, 'devanagari');
    if (parsed.numberedCount >= 1 || parsed.verseCount >= 1) {
      return {
        ok: true, slug,
        name: meta.name || null,
        title: extractTitle(require('../parse').stripMarkup(r.html)),
        tradition: meta.tradition || null,
        deity: meta.deity || null,
        verses: parsed.verses, verseCount: parsed.verseCount, numberedCount: parsed.numberedCount, lastNumber: parsed.lastNumber,
        script: 'devanagari', source: label, sourceId: id, sourceUrl: url, license,
      };
    }
    tried[tried.length - 1].note = 'fetched but no verses parsed';
  }
  return { ok: false, status: tried.length ? tried[tried.length - 1].status || -1 : 0, slug, sourceId: id, tried };
}

module.exports = { id, label, license, candidateUrls, fetchBySlug, SLUG_MAP };

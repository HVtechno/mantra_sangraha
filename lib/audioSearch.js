// lib/audioSearch.js
// Finds a genuinely ad-free recitation for a mantra from the Internet Archive
// (archive.org) — plain MP3 files, no ad system, legal to stream with
// attribution, and (unlike a YouTube embed) analysable by the browser so the
// karaoke Auto-sync works.
//
// Flow: advancedsearch by mantra name (mediatype:audio) -> score candidates to
// prefer actual recitations over hour-long lectures/discourses -> resolve the
// best item's MP3 via its /metadata. Results are cached per mantra.
//
// Network lives here; the scoring/selection helpers are pure and unit-tested.

const cache = require('./cache');
const { normalize } = require('./aliases');

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

const details = (id) => `https://archive.org/details/${encodeURIComponent(id)}`;
const downloadUrl = (id, file) =>
  `https://archive.org/download/${encodeURIComponent(id)}/${String(file).split('/').map(encodeURIComponent).join('/')}`;

// --- pure helpers (unit-tested) --------------------------------------------

// Words that mark a recitation vs. a talk. Recitation = good; lecture = skip.
const GOOD = /(stotra|stotram|stothram|sloka|slokam|shloka|ashtakam|ashtaka|lahari|chant|recitation|parayana|paaraayana|namavali|sahasranama|suktam|sooktam|mantra|kavacham|dhyanam|namakam|chamakam|gayatri|bhajan)/i;
const BAD = /(lecture|class|course|discourse|talk|speech|upanyasa|pravachan|pravachanam|commentary|explanation|meaning|interview|question|q\s*&\s*a|part\s*\d+|day\s*\d+|session|episode|lesson)/i;

// Split a CamelCase / hyphen / underscore identifier into words:
// "VishnuSahasranamaStotram-ByJeeyar" -> "Vishnu Sahasranama Stotram By Jeeyar".
function deCamel(s) {
  return String(s || '')
    .replace(/[-_]+/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2');
}

// The searchable text for a doc. archive.org's search often returns docs with
// NO title field (only identifier), so we ALWAYS fold in the de-camelCased
// identifier — otherwise title-only scoring silently rejects everything.
function docText(doc) {
  return normalize(`${deCamel(doc && doc.identifier)} ${(doc && doc.title) || ''}`);
}

// A human-readable title for display (falls back to the identifier's words).
function docTitle(doc) {
  const t = (doc && doc.title && String(doc.title).trim()) || '';
  return t || deCamel(doc && doc.identifier);
}

// Score how well an archive doc matches the mantra name (higher = better).
function scoreDoc(nameNorm, doc) {
  const text = docText(doc);
  if (!text) return 0;
  const toks = nameNorm.split(' ').filter((t) => t.length > 1);
  let covered = 0;
  for (const tok of toks) if (text.includes(tok)) covered += 1;
  if (!covered) return 0; // must share at least one name word
  let s = covered * 10;
  if (toks.length && covered >= toks.length) s += 15;
  if (GOOD.test(text)) s += 8;
  if (BAD.test(text)) s -= 14;
  const dl = Number(doc && doc.downloads) || 0;
  s += Math.min(5, Math.log10(dl + 1)); // gentle popularity nudge (0 if absent)
  return s;
}

// Rank candidate docs; drop non-matches. Returns [{ identifier, title, score }].
function rankDocs(name, docs) {
  const nameNorm = normalize(name);
  return (docs || [])
    .map((d) => ({ identifier: d.identifier, title: docTitle(d), score: scoreDoc(nameNorm, d) }))
    .filter((x) => x.identifier && x.score > 0)
    .sort((a, b) => b.score - a.score);
}

// From an item's file list, choose the best MP3 to play. MANY archive items are
// multi-track albums (a whole set of stotras), so picking by length alone grabs
// the wrong track. Instead we match each filename against the mantra name and
// prefer the file that actually IS this mantra; only when nothing matches do we
// fall back to the longest track (a full recitation is long, filler clips short).
// Returns { name, duration, match } where match is 0..1 filename relevance.
function pickMp3(files, nameNorm = '') {
  const mp3s = (files || []).filter(
    (f) => /mp3/i.test(f.format || '') || /\.mp3$/i.test(f.name || '')
  );
  if (!mp3s.length) return null;
  const toks = String(nameNorm).split(' ').filter((t) => t.length > 2);
  const scored = mp3s.map((f) => {
    const base = normalize(String(f.name || '').replace(/\.mp3$/i, ''));
    let hit = 0;
    for (const t of toks) if (base.includes(t)) hit += 1;
    return { f, len: parseFloat(f.length) || 0, match: toks.length ? hit / toks.length : 0 };
  });
  const named = scored.filter((x) => x.match >= 0.5);
  const pool = named.length ? named : scored;
  // best filename match first; tie-break toward the longer (main) recitation
  pool.sort((a, b) => (b.match - a.match) || (b.len - a.len));
  const chosen = pool[0];
  return { name: chosen.f.name, duration: chosen.len || null, match: chosen.match };
}

// --- network ---------------------------------------------------------------

async function getJson(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': UA, Accept: 'application/json,*/*;q=0.8' },
      redirect: 'follow',
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

async function searchDocs(name, rows = 20) {
  const q = `(${name}) AND mediatype:audio`;
  const url =
    'https://archive.org/advancedsearch.php?q=' +
    encodeURIComponent(q) +
    '&fl%5B%5D=identifier&fl%5B%5D=title&fl%5B%5D=downloads' +
    '&sort%5B%5D=downloads+desc&rows=' + rows + '&output=json';
  const j = await getJson(url);
  return (j && j.response && j.response.docs) || [];
}

// Resolve a single archive item id to a playable MP3 + attribution. `name` is
// the mantra name, used to pick the right track inside multi-track albums.
async function resolveItem(id, name = '') {
  const m = await getJson(`https://archive.org/metadata/${encodeURIComponent(id)}`);
  if (!m || !Array.isArray(m.files)) return null;
  const pick = pickMp3(m.files, normalize(name));
  if (!pick) return null;
  const meta = m.metadata || {};
  return {
    ok: true,
    url: downloadUrl(id, pick.name),
    itemId: id,
    title: meta.title || id,
    creator: meta.creator || null,
    duration: pick.duration,
    match: pick.match,
    source: 'Internet Archive',
    sourceUrl: details(id),
    license: meta.licenseurl || null,
  };
}

// Public: find the best ad-free recitation for a mantra name. Scans the top
// candidates and keeps the one whose chosen track best matches the mantra name
// (so a dedicated recitation wins over a stray track in a compilation).
async function find(name) {
  const q = String(name || '').trim();
  if (!q) return { ok: false, error: 'empty' };
  const key = `audio:${normalize(q).replace(/\s+/g, '-')}`;
  const cached = cache.get(key);
  if (cached) return { ...cached, cached: true };

  let docs;
  try { docs = await searchDocs(q, 20); } catch (e) { return { ok: false, error: 'search_failed', message: String(e.message || e) }; }
  const ranked = rankDocs(q, docs);
  if (!ranked.length) return { ok: false, error: 'no_audio' };

  const alternatives = ranked.slice(0, 6).map((x) => ({ itemId: x.identifier, title: x.title }));
  let best = null;
  for (const cand of ranked.slice(0, 5)) {
    try {
      const r = await resolveItem(cand.identifier, q);
      if (!r) continue;
      if (!best || r.match > best.match) best = r;
      if (r.match >= 0.75) break; // strong track match — good enough, stop early
    } catch { /* try next */ }
  }
  if (best) {
    const out = { ...best, alternatives };
    cache.set(key, out);
    return out;
  }
  return { ok: false, error: 'no_audio' };
}

// Public: resolve one specific item (used by the reader's "Try another").
async function findItem(itemId, name = '') {
  const id = String(itemId || '').trim();
  if (!id) return { ok: false, error: 'empty' };
  try {
    const r = await resolveItem(id, name);
    return r || { ok: false, error: 'no_audio' };
  } catch (e) {
    return { ok: false, error: 'resolve_failed', message: String(e.message || e) };
  }
}

module.exports = {
  // pure (tested)
  scoreDoc, rankDocs, pickMp3, downloadUrl, deCamel, docText, docTitle,
  // runtime
  find, findItem, resolveItem, searchDocs,
};

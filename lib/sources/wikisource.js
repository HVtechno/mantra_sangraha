// lib/sources/wikisource.js
// Source adapter for Wikisource (Wikimedia's library of verbatim public-domain
// texts). Unlike vignanam/sanskritdocuments (slug -> URL), Wikisource works by
// SEARCH: we query the edition matching the user's script, pick the best-matching
// page, fetch its content, and run it through the same parser. This is the
// generic fallback for texts the stotra sites don't carry (Sivapuranam, regional
// scriptures, …). No API key; the MediaWiki API is open.
//
// HONEST LIMIT: Wikisource titles are in native script (சிவபுராணம்) while users
// type romanised ("sivapuranam"). Wikimedia's search sometimes bridges that and
// sometimes doesn't — so this catches what its search matches. If it proves weak,
// the upgrade is to surface `search()` results as tappable suggestions instead of
// auto-picking (this adapter already exposes the pieces for that).

const { parseDocument } = require('../parse');
const { normalize } = require('../aliases');

const id = 'wikisource';
const label = 'Wikisource';
const license = 'Public-domain / CC text via Wikisource. Attribution: the linked Wikisource page.';

// Wikimedia's API policy REQUIRES a descriptive User-Agent identifying the app.
const UA = 'MantraSangraha/1.0 (https://mantra-sangraha.onrender.com; ad-free devotional text app)';

// Which Wikisource language edition(s) to search for a given text script.
const EDITIONS = {
  tamil: ['ta'], telugu: ['te'], kannada: ['kn'], malayalam: ['ml'],
  bengali: ['bn'], gujarati: ['gu'], odia: ['or'], oriya: ['or'],
  hindi: ['hi', 'sa'], devanagari: ['sa', 'hi'],
};
function editionsFor(script) { return EDITIONS[script] || ['sa']; }

// Curated pointers: a romanised name -> the EXACT Wikisource page. This is what
// makes the fallback actually work — Wikisource search is native-script, so a
// Latin query like "sivapuranam" can't find the Tamil-titled page on its own, and
// the text may live in a different-language edition than the user's UI. We hardcode
// only the pointer (edition + title); the verses are still fetched verbatim from
// Wikisource. Tiny to grow — add a line per text. `script` is the text's OWN
// script (Sivapuranam is Tamil regardless of the UI language).
const SIVAPURANAM = { wiki: 'ta', title: 'திருவாசகம்/சிவ புராணம்', script: 'tamil', name: 'Sivapuranam (Thiruvāsagam)', tradition: 'Manikkavacakar', deity: 'Shiva' };
const TITLE_MAP = {
  'sivapuranam': SIVAPURANAM, 'siva puranam': SIVAPURANAM, 'sivapuraanam': SIVAPURANAM,
  'thiruvasagam sivapuranam': SIVAPURANAM, 'thiruvasakam sivapuranam': SIVAPURANAM,
};
function mappedEntry(name, slug) {
  const cand = [normalize(name), normalize(String(slug || '').replace(/-/g, ' '))].filter(Boolean);
  for (const k of cand) if (TITLE_MAP[k]) return TITLE_MAP[k]; // exact
  for (const k of cand) for (const key of Object.keys(TITLE_MAP)) {
    if (key.length >= 6 && (k.includes(key) || key.includes(k))) return TITLE_MAP[key]; // forgiving
  }
  return null;
}

async function api(host, params) {
  const qs = new URLSearchParams({ format: 'json', formatversion: '2', ...params }).toString();
  const url = `https://${host}.wikisource.org/w/api.php?${qs}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' }, signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally { clearTimeout(timer); }
}

async function search(host, term) {
  const j = await api(host, { action: 'query', list: 'search', srsearch: term, srnamespace: '0', srlimit: '6' });
  return (j && j.query && j.query.search) || [];
}

// Pick the search result whose title best matches the requested name.
function bestTitle(name, results) {
  const n = normalize(name);
  const toks = n.split(' ').filter((t) => t.length > 2);
  let best = null, bs = 0;
  for (const r of results || []) {
    const t = normalize(r.title);
    let s = 0;
    for (const tok of toks) if (t.includes(tok)) s += 1;
    if (t === n) s += 5;
    if (s > bs) { bs = s; best = r; }
  }
  return best || (results && results[0]) || null;
}

async function fetchPageHtml(host, title) {
  const j = await api(host, { action: 'parse', page: title, prop: 'text', redirects: '1' });
  const txt = j && j.parse && j.parse.text;
  return typeof txt === 'string' ? txt : (txt && txt['*']) || null; // formatversion 1 vs 2
}

async function fetchBySlug(slug, meta = {}, script = 'devanagari') {
  const name = (meta && meta.name) || String(slug || '').replace(/-/g, ' ').trim();
  if (!name) return { ok: false, sourceId: id, tried: [] };
  const tried = [];

  // 1) Curated pointer — the reliable path (exact page, correct edition/script).
  const mapped = mappedEntry(name, slug);
  if (mapped) {
    try {
      const html = await fetchPageHtml(mapped.wiki, mapped.title);
      if (html) {
        const parsed = parseDocument(html, mapped.script);
        if (parsed.numberedCount >= 1 || parsed.verseCount >= 1) {
          const pageUrl = `https://${mapped.wiki}.wikisource.org/wiki/${encodeURIComponent(String(mapped.title).replace(/ /g, '_'))}`;
          return {
            ok: true, slug, name: mapped.name || meta.name || null, title: mapped.name || mapped.title,
            tradition: mapped.tradition || meta.tradition || null, deity: mapped.deity || meta.deity || null,
            verses: parsed.verses, verseCount: parsed.verseCount,
            numberedCount: parsed.numberedCount, lastNumber: parsed.lastNumber,
            script: mapped.script, source: `${label} (${mapped.wiki}.wikisource.org)`, sourceId: id, sourceUrl: pageUrl, license,
          };
        }
      }
      tried.push({ mapped: mapped.title, note: 'mapped page had no parsable verses' });
    } catch (e) { tried.push({ mapped: mapped.title, error: String((e && e.message) || e) }); }
  }

  // 2) Best-effort search (works only where Wikisource search bridges the query).
  for (const host of editionsFor(script)) {
    try {
      const results = await search(host, name);
      if (!results.length) { tried.push({ host, note: 'no search hits' }); continue; }
      const pick = bestTitle(name, results);
      if (!pick) { tried.push({ host, note: 'no title match' }); continue; }
      const html = await fetchPageHtml(host, pick.title);
      if (!html) { tried.push({ host, title: pick.title, note: 'no content' }); continue; }
      const parsed = parseDocument(html, script);
      if (parsed.numberedCount >= 1 || parsed.verseCount >= 1) {
        const pageUrl = `https://${host}.wikisource.org/wiki/${encodeURIComponent(String(pick.title).replace(/ /g, '_'))}`;
        return {
          ok: true, slug, name: meta.name || null, title: pick.title,
          tradition: meta.tradition || null, deity: meta.deity || null,
          verses: parsed.verses, verseCount: parsed.verseCount,
          numberedCount: parsed.numberedCount, lastNumber: parsed.lastNumber,
          script, source: `${label} (${host}.wikisource.org)`, sourceId: id, sourceUrl: pageUrl, license,
        };
      }
      tried.push({ host, title: pick.title, note: 'fetched but no verses parsed' });
    } catch (e) {
      tried.push({ host, error: String((e && e.message) || e) });
    }
  }
  return { ok: false, sourceId: id, tried };
}

module.exports = { id, label, license, editionsFor, bestTitle, mappedEntry, fetchBySlug };

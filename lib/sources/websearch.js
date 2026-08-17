// lib/sources/websearch.js
// The GENERIC final fallback: when vignanam / sanskritdocuments / wikisource all
// miss, ask a real search engine (via SerpAPI) for pages that have the text, then
// fetch + parse the best one with our existing parser. This is what makes any
// aarti / stotra / regional scripture findable from a romanised query without
// hardcoding — a search engine bridges "sivapuranam" -> the right native-script
// pages the way we never could ourselves.
//
// Dormant until process.env.SERPAPI_KEY is set (returns ok:false), so it is safe
// to ship before the key exists. Every SerpAPI query is cached (lib/cache) so the
// same search never spends a second credit — critical on the 250/month free tier.

const { parseDocument } = require('../parse');
const { normalize } = require('../aliases');
const cache = require('../cache');

const id = 'websearch';
const label = 'Web';
const UA = 'MantraSangraha/1.0 (https://mantra-sangraha.onrender.com; ad-free devotional text app) generic-source-fetch';

// Reputable text sources to prefer; junk/video/commerce to drop.
const GOOD = /(wikisource|sanskritdocuments|shaivam|shlokam|greenmesg|templepurohit|stotranidhi|vaidika|hindupedia|sacred-texts|prapatti|projectmadurai|tamilvu|sivaya|thevaaram|ambaa|dharmicscriptures|sanskritdocuments)/i;
const BAD = /(youtube|youtu\.be|facebook|fb\.com|instagram|pinterest|twitter|x\.com|reddit|spotify|amazon|flipkart|gaana|wynk|jiosaavn|apple\.com|play\.google|tiktok|quora)/i;

const INDIC_SCRIPTS = ['devanagari', 'tamil', 'telugu', 'kannada', 'malayalam', 'bengali', 'gujarati', 'odia'];

// --- pure helpers (unit-tested) --------------------------------------------

// Reject anything that isn't a public http(s) page (basic SSRF guard).
function safeUrl(u) {
  try {
    const url = new URL(u);
    if (!/^https?:$/.test(url.protocol)) return false;
    const h = url.hostname.toLowerCase();
    if (h === 'localhost' || h.endsWith('.local') || h === '::1' || h.includes('metadata')) return false;
    if (/^(0\.|127\.|10\.|192\.168\.|169\.254\.)/.test(h)) return false;
    if (/^172\.(1[6-9]|2\d|3[01])\./.test(h)) return false;
    return true;
  } catch { return false; }
}

// Rank search results by name relevance + a trusted-domain bonus; drop junk.
function rankCandidates(results, name) {
  const n = normalize(name);
  const toks = n.split(' ').filter((t) => t.length > 2);
  return (results || [])
    .filter((r) => r && r.link && safeUrl(r.link) && !BAD.test(r.link))
    .map((r) => {
      const hay = normalize(`${r.title || ''} ${r.snippet || ''} ${r.link}`);
      let s = 0;
      for (const t of toks) if (hay.includes(t)) s += 1;
      if (GOOD.test(r.link)) s += 3;
      return { ...r, score: s };
    })
    .sort((a, b) => b.score - a.score);
}

// Parse a page under whichever Indic script yields the most text (so a Tamil page
// parses as Tamil even when the query came from English/Devanagari mode).
function bestParse(html, preferred = 'devanagari') {
  const order = [preferred, ...INDIC_SCRIPTS.filter((s) => s !== preferred)];
  let best = null, bestScript = preferred;
  for (const s of order) {
    const p = parseDocument(html, s);
    const len = (p.verses || []).reduce((a, v) => a + String(v.text || '').length, 0);
    const score = (p.numberedCount || 0) * 200 + len;
    if (!best || score > best.score) { best = { parsed: p, len, score }; bestScript = s; }
  }
  return { parsed: best.parsed, script: bestScript, len: best.len };
}

// --- network ---------------------------------------------------------------

async function getJson(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' }, signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally { clearTimeout(timer); }
}

async function fetchPage(u) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const res = await fetch(u, { headers: { 'User-Agent': UA, Accept: 'text/html,application/xhtml+xml,*/*;q=0.8' }, redirect: 'follow', signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } finally { clearTimeout(timer); }
}

// SerpAPI (Google engine). Cached per query so we spend at most one credit each.
async function searchWeb(query) {
  const key = process.env.SERPAPI_KEY;
  if (!key) return null;
  const ck = `discover:${normalize(query)}`;
  const cached = cache.get(ck);
  if (cached) return cached;
  const url = `https://serpapi.com/search.json?engine=google&num=10&q=${encodeURIComponent(query)}&api_key=${encodeURIComponent(key)}`;
  const j = await getJson(url);
  const results = ((j && j.organic_results) || [])
    .map((r) => ({ link: r.link, title: r.title, snippet: r.snippet }))
    .filter((r) => r.link);
  cache.set(ck, results); // cache even an empty list (avoids re-spending on known misses)
  return results;
}

async function fetchBySlug(slug, meta = {}, script = 'devanagari') {
  const name = (meta && meta.name) || String(slug || '').replace(/-/g, ' ').trim();
  if (!name) return { ok: false, sourceId: id, tried: [] };
  if (!process.env.SERPAPI_KEY) return { ok: false, sourceId: id, note: 'no-serpapi-key' };

  let results;
  try { results = await searchWeb(`${name} lyrics`); }
  catch (e) { return { ok: false, sourceId: id, error: String((e && e.message) || e) }; }
  if (!results || !results.length) return { ok: false, sourceId: id, tried: [] };

  const ranked = rankCandidates(results, name);
  const tried = [];
  for (const cand of ranked.slice(0, 4)) {
    try {
      const html = await fetchPage(cand.link);
      const { parsed, script: got, len } = bestParse(html, script);
      if (parsed.numberedCount >= 1 || (parsed.verseCount >= 1 && len >= 80)) {
        let host = ''; try { host = new URL(cand.link).hostname.replace(/^www\./, ''); } catch {}
        return {
          ok: true, slug, name: meta.name || null, title: meta.name || name,
          tradition: meta.tradition || null, deity: meta.deity || null,
          verses: parsed.verses, verseCount: parsed.verseCount,
          numberedCount: parsed.numberedCount, lastNumber: parsed.lastNumber,
          script: got, source: `Web · ${host}`, sourceId: id, sourceUrl: cand.link,
          license: 'Text fetched from a third-party page — please verify accuracy. Source linked.',
        };
      }
      tried.push({ url: cand.link, note: 'no verses parsed' });
    } catch (e) { tried.push({ url: cand.link, error: String((e && e.message) || e) }); }
  }
  return { ok: false, sourceId: id, tried };
}

module.exports = { id, label, fetchBySlug, rankCandidates, safeUrl, bestParse };

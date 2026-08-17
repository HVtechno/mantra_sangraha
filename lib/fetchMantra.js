// lib/fetchMantra.js
// Orchestrator: resolve a user query -> pick a slug -> try source adapters in
// priority order -> cache the clean result.
//
// Adding a new source (sanskritdocuments, stotranidhi, ...) is a matter of
// dropping another adapter into SOURCES with the same fetchBySlug(slug, meta)
// shape.

const aliases = require('./aliases');
const catalog = require('./catalog');
const cache = require('./cache');
const vignanam = require('./sources/vignanam');
const sanskritdocuments = require('./sources/sanskritdocuments');
const wikisource = require('./sources/wikisource');
const websearch = require('./sources/websearch');

// Tried in order, each firing only when the previous miss:
//   vignanam (all scripts) -> sanskritdocuments (Devanagari) -> wikisource
//   (curated pointers + search) -> websearch (SerpAPI-powered generic discovery:
//   search the web for ANY text, fetch + parse the best page). websearch is
//   dormant until SERPAPI_KEY is set, so this is safe to ship before the key.
const SOURCES = [vignanam, sanskritdocuments, wikisource, websearch];

/**
 * @param {string} query  raw text the user typed
 * @returns {Promise<object>} clean JSON result
 */
async function fetchMantra(query, script = 'devanagari') {
  const q = String(query || '').trim();
  if (!q) return { ok: false, error: 'empty_query', message: 'Please enter a mantra name.' };

  // Resolution chain: curated alias (rich metadata) -> vignanam's full sitemap
  // index (any stotra on the site) -> slugify guess (last resort).
  const rec = aliases.resolve(q);
  let slug, meta;
  if (rec) {
    slug = rec.slug;
    meta = rec;
  } else {
    let hit = null;
    try { hit = await catalog.resolveSlug(q); } catch { hit = null; }
    if (hit) {
      slug = hit.slug;
      meta = { name: hit.name, tradition: null, deity: null, fromIndex: true };
    } else {
      slug = aliases.slugify(q);
      meta = { name: titleCase(q), tradition: null, deity: null };
    }
  }

  const cacheKey = `mantra:${slug}:${script}`;
  const cached = cache.get(cacheKey);
  if (cached) return { ...cached, cached: true };

  const tried = [];
  for (const src of SOURCES) {
    let result;
    try {
      result = await src.fetchBySlug(slug, meta, script);
    } catch (e) {
      tried.push({ source: src.id, error: String(e && e.message || e) });
      continue;
    }
    tried.push({ source: src.id, status: result.status, ok: result.ok, urls: result.tried });
    if (result.ok) {
      const clean = {
        ok: true,
        id: slug,
        name: result.name || meta.name || titleCase(q),
        title: result.title || null,
        tradition: result.tradition || meta.tradition || null,
        deity: result.deity || meta.deity || null,
        script: result.script,
        source: result.source,
        sourceUrl: result.sourceUrl,
        license: result.license,
        verses: result.verses,
        verseCount: result.verseCount,
        numberedCount: result.numberedCount,
        lastNumber: result.lastNumber,
        fetchedAt: new Date().toISOString(),
        matchedAlias: !!rec,
      };
      cache.set(cacheKey, clean);
      return clean;
    }
  }

  return {
    ok: false,
    error: 'not_found',
    message: rec
      ? `Found "${meta.name}" in the catalog but couldn't fetch it right now.`
      : `Couldn't find "${q}". Try a fuller name, or pick from suggestions.`,
    querySlug: slug,
    suggestions: mergeSuggestions(q, 6),
    tried,
  };
}

// Curated suggestions first (they carry deity/tradition), then fill from the
// full sitemap index — deduped by slug — so users always see real, fetchable
// options even for texts we never hand-added.
function mergeSuggestions(q, limit = 6) {
  const out = [];
  const seen = new Set();
  for (const r of aliases.suggest(q, limit)) {
    if (seen.has(r.slug)) continue;
    seen.add(r.slug);
    out.push({ name: r.name, deity: r.deity, slug: r.slug });
  }
  if (out.length < limit) {
    for (const e of catalog.suggestFromIndex(q, limit * 2)) {
      if (seen.has(e.slug)) continue;
      seen.add(e.slug);
      out.push({ name: e.name, deity: null, slug: e.slug });
      if (out.length >= limit) break;
    }
  }
  return out;
}

// Sourced verse meanings (English), from the first source that provides them.
async function fetchMeaning(query, script = 'devanagari') {
  const q = String(query || '').trim();
  if (!q) return { ok: false, error: 'empty_query' };
  const rec = aliases.resolve(q);
  const slug = rec ? rec.slug : aliases.slugify(q);
  const meta = rec || { name: titleCase(q) };

  const cacheKey = `meaning:${slug}:${script}`;
  const cached = cache.get(cacheKey);
  if (cached) return { ...cached, cached: true };

  for (const src of SOURCES) {
    if (typeof src.fetchMeaning !== 'function') continue;
    let result;
    try { result = await src.fetchMeaning(slug, meta, script); } catch { continue; }
    if (result && result.ok) {
      const clean = { ok: true, id: slug, meanings: result.meanings, source: result.source, sourceUrl: result.sourceUrl };
      cache.set(cacheKey, clean);
      return clean;
    }
  }
  return { ok: false, error: 'no_meaning', id: slug };
}

function titleCase(s) {
  return String(s)
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\w\S*/g, (w) => w.charAt(0).toUpperCase() + w.slice(1));
}

module.exports = { fetchMantra, fetchMeaning, SOURCES };

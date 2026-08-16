// lib/catalog.js
// A dynamic, full-site index of vignanam.org — so ANY stotra on the site is
// searchable, not just the hand-curated aliases in lib/aliases.js.
//
// vignanam publishes a standard sitemap. Every stotra page appears as
// /<lang>/<slug>.html, and the <slug> is identical across scripts
// (/english/venkateswara-stotram.html and /devanagari/venkateswara-stotram.html
// share one slug). We harvest every slug, derive a readable name from it, and
// keep a { slug, name, nameNorm, tokens } index. It is cached in-memory and on
// disk (via lib/cache) with a weekly TTL and refreshed lazily in the background,
// so after the very first build every request reads it instantly.
//
// The network lives in build(); everything else (parsing, scoring) is pure and
// unit-tested with fixtures.

const cache = require('./cache');
const { normalize } = require('./aliases');

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

const SITEMAP_URLS = [
  'https://www.vignanam.org/sitemap.xml',
  'https://vignanam.org/sitemap.xml',
];
const INDEX_KEY = 'vignanam:index:v1';
const REFRESH_MS = 1000 * 60 * 60 * 24 * 7; // rebuild at most weekly
const MAX_CHILD_SITEMAPS = 50; // guard against pathological sitemap indexes

// Directories that are language/script variants where /<dir>/<slug>.html is a
// fetchable stotra. Anything else (media/, blog/, category pages, /veda/ with
// its odd -devanagari suffixes) is ignored so slugs stay canonical.
const LANG_DIRS = new Set([
  'english', 'devanagari', 'samskritam', 'sanskrit', 'hindi',
  'telugu', 'tamil', 'kannada', 'malayalam', 'bengali', 'gujarati',
  'odia', 'oriya', 'punjabi', 'gurmukhi', 'assamese',
]);

// --- pure helpers (unit-tested) --------------------------------------------

// Extract every <loc>…</loc> value from a sitemap or sitemap-index document.
function extractLocs(xml) {
  const out = [];
  const re = /<loc>\s*([^<\s]+)\s*<\/loc>/gi;
  let m;
  while ((m = re.exec(String(xml || '')))) out.push(m[1].trim());
  return out;
}

function isSitemapIndex(xml) {
  return /<sitemapindex[\s>]/i.test(String(xml || ''));
}

// Title-case a slug into a readable name: "sri-rudram-namakam" -> "Sri Rudram Namakam".
function titleize(slug) {
  return String(slug || '')
    .split('-')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

// Turn a sitemap <loc> into { slug, name } if it is a <lang>/<slug>.html stotra
// page. vignanam's sitemap uses RELATIVE locs ("english/venkateswara-stotram.html"),
// but we also accept absolute URLs and leading slashes. Returns null for anything
// that isn't exactly two path segments under a known language directory (so bare
// landing pages like "devanagari.html" and nested "media/<lang>/<slug>.html" are
// rejected, keeping slugs canonical).
function slugFromLoc(loc) {
  let p = String(loc || '').trim();
  if (!p) return null;
  p = p.replace(/^https?:\/\/[^/]+\//i, ''); // strip scheme + host if present
  p = p.replace(/^\/+/, '');                 // strip leading slashes
  p = p.replace(/[?#].*$/, '');              // drop query / hash
  const m = p.match(/^([a-z-]+)\/([a-z0-9-]+)\.html?$/i);
  if (!m) return null;
  const dir = m[1].toLowerCase().replace(/^shuddha-/, '');
  if (!LANG_DIRS.has(dir)) return null;
  return { slug: m[2].toLowerCase(), name: titleize(m[2].toLowerCase()) };
}

// Build the index array from a list of page URLs (deduped by slug).
function indexFromLocs(locs) {
  const seen = new Map();
  for (const loc of locs || []) {
    const rec = slugFromLoc(loc);
    if (rec && !seen.has(rec.slug)) seen.set(rec.slug, rec.name);
  }
  return [...seen].map(([slug, name]) => {
    const nameNorm = normalize(name);
    return { slug, name, nameNorm, tokens: nameNorm.split(' ').filter(Boolean) };
  });
}

// Score how well a query matches an index entry (higher = better). Tuned for
// both as-you-type prefixes and full names.
function scoreEntry(qNorm, entry) {
  const qd = qNorm.replace(/\s+/g, '');
  if (!qd) return 0;
  const nd = entry.nameNorm.replace(/\s+/g, '');
  let s = 0;
  if (entry.nameNorm === qNorm) s += 100;
  if (nd === qd) s += 90;
  if (nd.startsWith(qd)) s += 55;
  else if (nd.includes(qd)) s += 32;
  const qt = qNorm.split(' ').filter(Boolean);
  let covered = 0;
  for (const t of qt) {
    if (entry.tokens.some((w) => w === t)) covered += 1.0;
    else if (entry.tokens.some((w) => w.startsWith(t) || t.startsWith(w))) covered += 0.6;
    else if (entry.tokens.some((w) => w.includes(t))) covered += 0.3;
  }
  s += covered * 9;
  if (qt.length && covered >= qt.length) s += 10;
  return s;
}

// Bounded Levenshtein ratio (0..1) on despaced strings — used only to accept a
// close near-miss when the plain scorer is lukewarm (small typos).
function levRatio(a, b) {
  a = a.replace(/\s+/g, ''); b = b.replace(/\s+/g, '');
  const la = a.length, lb = b.length;
  if (!la || !lb) return 0;
  if (Math.abs(la - lb) > 4) return 0; // cheap early-out for very different lengths
  const prev = new Array(lb + 1);
  const cur = new Array(lb + 1);
  for (let j = 0; j <= lb; j++) prev[j] = j;
  for (let i = 1; i <= la; i++) {
    cur[0] = i;
    for (let j = 1; j <= lb; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
    }
    for (let j = 0; j <= lb; j++) prev[j] = cur[j];
  }
  const dist = prev[lb];
  return 1 - dist / Math.max(la, lb);
}

// Rank the index for a query; returns up to `limit` entries, best first.
function searchIndex(index, query, limit = 10) {
  const qNorm = normalize(query);
  if (!qNorm || !index || !index.length) return [];
  const scored = [];
  for (const e of index) {
    const s = scoreEntry(qNorm, e);
    if (s > 0) scored.push({ e, s });
  }
  scored.sort((a, b) => b.s - a.s);
  return scored.slice(0, limit).map((x) => x.e);
}

// Best single match for auto-resolving a typed query. Requires a confident hit
// (strong scorer result, or a close Levenshtein near-miss) — otherwise null so
// the caller falls back to slugify.
function bestMatch(index, query) {
  const qNorm = normalize(query);
  if (!qNorm || !index || !index.length) return null;
  let best = null;
  for (const e of index) {
    const s = scoreEntry(qNorm, e);
    if (!best || s > best.s) best = { e, s };
  }
  if (!best) return null;
  if (best.s >= 40) return best.e; // despaced-substring or good token coverage
  // lukewarm: accept only if it's a close spelling of the whole query
  if (levRatio(qNorm, best.e.nameNorm) >= 0.84) return best.e;
  return null;
}

// --- network + cache (build) ------------------------------------------------

async function fetchText(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': UA, Accept: 'application/xml,text/xml,*/*;q=0.8' },
      redirect: 'follow',
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

async function fetchFirst(urls) {
  let lastErr;
  for (const u of urls) {
    try { return await fetchText(u); } catch (e) { lastErr = e; }
  }
  throw lastErr || new Error('no sitemap url reachable');
}

let memIndex = null;   // { at, slugs: [...] }
let building = null;   // in-flight build promise (dedupe)

async function build() {
  const root = await fetchFirst(SITEMAP_URLS);
  let pageLocs = extractLocs(root);
  if (isSitemapIndex(root)) {
    const children = pageLocs.slice(0, MAX_CHILD_SITEMAPS);
    const results = await Promise.allSettled(children.map((u) => fetchText(u)));
    pageLocs = [];
    for (const r of results) if (r.status === 'fulfilled') pageLocs.push(...extractLocs(r.value));
  }
  const slugs = indexFromLocs(pageLocs);
  const payload = { at: Date.now(), slugs };
  if (slugs.length) {
    memIndex = payload;
    try { cache.set(INDEX_KEY, payload); } catch {}
  }
  return slugs;
}

// Kick off a build if we don't have a fresh index; dedupe concurrent builds.
function ensureIndex() {
  if (memIndex && Date.now() - memIndex.at < REFRESH_MS) return Promise.resolve(memIndex.slugs);
  if (building) return building;
  building = build().finally(() => { building = null; });
  return building;
}

// Synchronous best-effort accessor for hot paths (search suggestions). Returns
// the current index array (loading it from the disk cache if needed) or [] if
// nothing is ready yet — and triggers a background build/refresh when stale.
function peek() {
  if (memIndex && Date.now() - memIndex.at < REFRESH_MS) return memIndex.slugs;
  // try disk cache (synchronous read inside lib/cache)
  let cached = null;
  try { cached = cache.get(INDEX_KEY); } catch {}
  if (cached && Array.isArray(cached.slugs)) {
    memIndex = cached;
    if (Date.now() - cached.at >= REFRESH_MS) ensureIndex().catch(() => {}); // refresh in bg
    return cached.slugs;
  }
  ensureIndex().catch(() => {}); // first-ever build, in background
  return memIndex ? memIndex.slugs : [];
}

// Suggestions from the full index (used by /api/search alongside curated).
function suggestFromIndex(query, limit = 10) {
  return searchIndex(peek(), query, limit);
}

// Resolve a typed query to a real slug when the curated catalog misses.
// Waits (bounded) for a first build if necessary, then falls back to null.
async function resolveSlug(query) {
  let index = peek();
  if (!index.length) {
    try { index = await Promise.race([ensureIndex(), delay(6000).then(() => [])]); } catch { index = []; }
  }
  const hit = bestMatch(index, query);
  return hit ? { slug: hit.slug, name: hit.name } : null;
}

function delay(ms) { return new Promise((r) => setTimeout(r, ms)); }

module.exports = {
  // pure (tested)
  extractLocs, isSitemapIndex, titleize, slugFromLoc, indexFromLocs,
  scoreEntry, levRatio, searchIndex, bestMatch,
  // runtime
  ensureIndex, peek, suggestFromIndex, resolveSlug, build,
  INDEX_KEY, REFRESH_MS,
};

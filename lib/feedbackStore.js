// lib/feedbackStore.js
// Persistent store for user submissions (mantra requests + feedback), plus an
// ARCHIVE list so the active view stays small.
//
// Two backends, chosen at runtime with ZERO code change:
//   1) Upstash Redis (serverless, HTTP) — used when UPSTASH_REDIS_REST_URL and
//      UPSTASH_REDIS_REST_TOKEN are set (production, e.g. Render).
//   2) Local JSON files under .data/ — the fallback for `npm run dev`.
//
// Stores only what the user typed + lang/version + a random anonymous device id.
// No IP, no precise location.

const KEY = 'ms:feedback';                 // active list
const ARCHIVE = 'ms:feedback:archive';     // archived list
const MAX = 500;                           // cap on the active list
const ARCHIVE_MAX = 3000;                  // cap on the archive
const DAY = 86400000;

const URL_ = process.env.UPSTASH_REDIS_REST_URL || '';
const TOK_ = process.env.UPSTASH_REDIS_REST_TOKEN || '';
const useRedis = !!(URL_ && TOK_);

// --- Upstash REST helpers ---------------------------------------------------
async function redis(cmd) {
  const res = await fetch(URL_, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOK_}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(cmd),
    cache: 'no-store', // never let Next cache a store read/write by request body
  });
  if (!res.ok) throw new Error(`Upstash HTTP ${res.status}`);
  const j = await res.json();
  if (j && j.error) throw new Error(`Upstash: ${j.error}`);
  return j ? j.result : null;
}

// Upstash may return a stored value as an object, a JSON string, or a
// double-encoded string. Accept all three.
function coerceRecord(r) {
  let v = r;
  if (typeof v === 'string') { try { v = JSON.parse(v); } catch { return null; } }
  if (typeof v === 'string') { try { v = JSON.parse(v); } catch { return null; } }
  return v && typeof v === 'object' ? v : null;
}

// --- File fallback ----------------------------------------------------------
function paths() {
  const path = require('path');
  const dir = path.join(process.cwd(), '.data');
  return { dir, active: path.join(dir, 'feedback.json'), archive: path.join(dir, 'feedback-archive.json') };
}
function readJson(file) {
  const fs = require('fs');
  try { return JSON.parse(fs.readFileSync(file, 'utf8')) || []; } catch { return []; }
}
function writeJson(file, list) {
  const fs = require('fs');
  try { fs.mkdirSync(paths().dir, { recursive: true }); } catch {}
  fs.writeFileSync(file, JSON.stringify(list));
}
const readActive = () => readJson(paths().active);
const writeActive = (l) => writeJson(paths().active, l);
const readArchive = () => readJson(paths().archive);
const writeArchive = (l) => writeJson(paths().archive, l);

// --- helpers ----------------------------------------------------------------
function listKey(area) { return area === 'archive' ? ARCHIVE : KEY; }
async function redisRows(key) { const r = await redis(['LRANGE', key, '0', '-1']); return Array.isArray(r) ? r : []; }
// Find the exact raw stored string for an id (needed for LREM).
async function findRaw(key, id) {
  for (const r of await redisRows(key)) { const rec = coerceRecord(r); if (rec && rec.id === id) return r; }
  return null;
}

// --- public API -------------------------------------------------------------

async function saveFeedback(entry) {
  const rec = {
    id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    ts: Date.now(),
    kind: entry.kind === 'mantra' ? 'mantra' : 'feedback',
    text: String(entry.text || '').slice(0, 2000),
    rating: Math.max(0, Math.min(5, Math.round(Number(entry.rating) || 0))),
    contact: String(entry.contact || '').slice(0, 200),
    lang: String(entry.lang || '').slice(0, 8),
    script: String(entry.script || '').slice(0, 20),
    version: String(entry.version || '').slice(0, 20),
    client: String(entry.client || '').slice(0, 40),
  };
  if (useRedis) {
    await redis(['LPUSH', KEY, JSON.stringify(rec)]);
    await redis(['LTRIM', KEY, '0', String(MAX - 1)]);
  } else {
    const list = readActive(); list.unshift(rec); writeActive(list.slice(0, MAX));
  }
  return rec;
}

// List active (default) or archived submissions, newest first.
async function listFeedback(limit = MAX, area = 'active') {
  const n = Math.max(1, Math.min(area === 'archive' ? ARCHIVE_MAX : MAX, Number(limit) || MAX));
  if (useRedis) return (await redisRows(listKey(area))).slice(0, n).map(coerceRecord).filter(Boolean);
  return (area === 'archive' ? readArchive() : readActive()).slice(0, n);
}

// Move one item from active -> archive.
async function archiveItem(id) {
  if (useRedis) {
    const raw = await findRaw(KEY, id);
    if (!raw) return false;
    await redis(['LREM', KEY, '1', raw]);
    await redis(['LPUSH', ARCHIVE, raw]);
    await redis(['LTRIM', ARCHIVE, '0', String(ARCHIVE_MAX - 1)]);
    return true;
  }
  const list = readActive(); const i = list.findIndex((x) => x.id === id);
  if (i < 0) return false;
  const [rec] = list.splice(i, 1); writeActive(list);
  const arch = readArchive(); arch.unshift(rec); writeArchive(arch.slice(0, ARCHIVE_MAX));
  return true;
}

// Move one item from archive -> active.
async function restoreItem(id) {
  if (useRedis) {
    const raw = await findRaw(ARCHIVE, id);
    if (!raw) return false;
    await redis(['LREM', ARCHIVE, '1', raw]);
    await redis(['LPUSH', KEY, raw]);
    return true;
  }
  const arch = readArchive(); const i = arch.findIndex((x) => x.id === id);
  if (i < 0) return false;
  const [rec] = arch.splice(i, 1); writeArchive(arch);
  const list = readActive(); list.unshift(rec); writeActive(list);
  return true;
}

// Permanently delete one item from the given area.
async function deleteItem(id, area = 'active') {
  const key = listKey(area);
  if (useRedis) {
    const raw = await findRaw(key, id);
    if (!raw) return false;
    await redis(['LREM', key, '1', raw]);
    return true;
  }
  const read = area === 'archive' ? readArchive : readActive;
  const write = area === 'archive' ? writeArchive : writeActive;
  const list = read(); const i = list.findIndex((x) => x.id === id);
  if (i < 0) return false;
  list.splice(i, 1); write(list);
  return true;
}

// Auto-retention: move FEEDBACK older than `days` from active -> archive.
// Mantra requests are left for you to archive by hand once you've added them.
async function pruneOldFeedback(days = 30) {
  const cutoff = Date.now() - days * DAY;
  let moved = 0;
  if (useRedis) {
    for (const r of await redisRows(KEY)) {
      const rec = coerceRecord(r);
      if (rec && rec.kind === 'feedback' && rec.ts && rec.ts < cutoff) {
        await redis(['LREM', KEY, '1', r]);
        await redis(['LPUSH', ARCHIVE, r]);
        moved++;
      }
    }
    if (moved) await redis(['LTRIM', ARCHIVE, '0', String(ARCHIVE_MAX - 1)]);
    return moved;
  }
  const list = readActive(); const keep = [], move = [];
  for (const x of list) { (x.kind === 'feedback' && x.ts && x.ts < cutoff ? move : keep).push(x); }
  if (move.length) { writeActive(keep); writeArchive([...move, ...readArchive()].slice(0, ARCHIVE_MAX)); }
  return move.length;
}

function backend() { return useRedis ? 'upstash' : 'file'; }

// Raw counts straight from the backend.
async function counts() {
  if (useRedis) {
    const [a, r] = await Promise.all([redis(['LLEN', KEY]), redis(['LLEN', ARCHIVE])]);
    return { active: Number(a) || 0, archive: Number(r) || 0 };
  }
  return { active: readActive().length, archive: readArchive().length };
}

module.exports = { saveFeedback, listFeedback, archiveItem, restoreItem, deleteItem, pruneOldFeedback, backend, counts };

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

// --- Visit + Seva counters (anonymous aggregate totals, no PII) --------------
const V_TOTAL = 'ms:visits:total';
const V_DAY = 'ms:visits:d:';        // + YYYY-MM-DD (IST) — raw app opens
const U_TOTAL = 'ms:users:total';    // HyperLogLog of anonymous device ids (unique users)
const U_DAY = 'ms:users:d:';         // + YYYY-MM-DD (IST) — unique devices seen that day (DAU)
const S_COUNT = 'ms:seva:count';     // number of seva taps (intent, not confirmed pay)
const S_SUM = 'ms:seva:sum';         // sum of intended rupee amounts

// Day bucket in IST (audience is India) — shift by +5:30 then take the UTC date.
function dayKeyIST(ts) { return new Date((ts || Date.now()) + 5.5 * 3600000).toISOString().slice(0, 10); }
function lastDays(n) { const out = []; const now = Date.now(); for (let i = n - 1; i >= 0; i--) out.push(dayKeyIST(now - i * DAY)); return out; }

function statsFile() { return require('path').join(paths().dir, 'stats.json'); }
function readStats() { const fs = require('fs'); try { const j = JSON.parse(fs.readFileSync(statsFile(), 'utf8')) || {}; j.days = j.days || {}; return j; } catch { return { total: 0, days: {}, sevaCount: 0, sevaSum: 0 }; } }
function writeStats(s) { const fs = require('fs'); try { fs.mkdirSync(paths().dir, { recursive: true }); } catch {} fs.writeFileSync(statsFile(), JSON.stringify(s)); }

// Count one visit (called once per browser session from the client). `clientId`
// is the anonymous per-device id — used to count UNIQUE users via HyperLogLog
// (PFADD is idempotent, so the same device is never double-counted).
async function bumpVisit(clientId) {
  const day = dayKeyIST();
  const id = String(clientId || '').slice(0, 60);
  if (useRedis) {
    await redis(['INCR', V_TOTAL]); await redis(['INCR', V_DAY + day]);
    if (id) { await redis(['PFADD', U_TOTAL, id]); await redis(['PFADD', U_DAY + day, id]); }
    return true;
  }
  const s = readStats();
  s.total = (s.total || 0) + 1; s.days[day] = (s.days[day] || 0) + 1;
  if (id) {
    s.users = s.users || { ids: [], days: {} };
    if (!s.users.ids.includes(id)) s.users.ids.push(id);
    s.users.days[day] = s.users.days[day] || [];
    if (!s.users.days[day].includes(id)) s.users.days[day].push(id);
  }
  writeStats(s); return true;
}

// Count one seva tap + its intended amount (interest signal — not a confirmed payment).
async function bumpSeva(amount) {
  const amt = Math.max(0, Math.min(100000, Math.round(Number(amount) || 0)));
  if (useRedis) { await redis(['INCR', S_COUNT]); if (amt) await redis(['INCRBY', S_SUM, String(amt)]); return true; }
  const s = readStats(); s.sevaCount = (s.sevaCount || 0) + 1; s.sevaSum = (s.sevaSum || 0) + amt; writeStats(s); return true;
}

// Aggregate stats for the admin dashboard.
async function getStats() {
  const days = lastDays(7);
  if (useRedis) {
    const [total, count, sum, uTotal] = await Promise.all([
      redis(['GET', V_TOTAL]), redis(['GET', S_COUNT]), redis(['GET', S_SUM]), redis(['PFCOUNT', U_TOTAL]),
    ]);
    const vVals = await redis(['MGET', ...days.map((d) => V_DAY + d)]);
    const uDaily = await Promise.all(days.map((d) => redis(['PFCOUNT', U_DAY + d])));
    const usersWeek = await redis(['PFCOUNT', ...days.map((d) => U_DAY + d)]); // union of 7 days = weekly active
    const last7 = days.map((d, i) => ({ date: d, visits: Number((vVals && vVals[i]) || 0), users: Number(uDaily[i] || 0) }));
    return {
      visitsTotal: Number(total || 0), visitsToday: last7[last7.length - 1].visits,
      usersTotal: Number(uTotal || 0), usersToday: last7[last7.length - 1].users, usersWeek: Number(usersWeek || 0),
      last7, sevaCount: Number(count || 0), sevaSum: Number(sum || 0),
    };
  }
  const s = readStats();
  const U = s.users || { ids: [], days: {} };
  const last7 = days.map((d) => ({ date: d, visits: Number(s.days[d] || 0), users: (U.days[d] || []).length }));
  const weekSet = new Set(); days.forEach((d) => (U.days[d] || []).forEach((x) => weekSet.add(x)));
  return {
    visitsTotal: Number(s.total || 0), visitsToday: last7[last7.length - 1].visits,
    usersTotal: (U.ids || []).length, usersToday: last7[last7.length - 1].users, usersWeek: weekSet.size,
    last7, sevaCount: Number(s.sevaCount || 0), sevaSum: Number(s.sevaSum || 0),
  };
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

module.exports = { saveFeedback, listFeedback, archiveItem, restoreItem, deleteItem, pruneOldFeedback, backend, counts, bumpVisit, bumpSeva, getStats };

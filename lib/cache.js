// lib/cache.js
// Two-tier cache: an in-process Map (instant within a running server) plus a
// small on-disk JSON cache under ./.cache so popular mantras survive restarts
// and we hit the source sites lightly. No external dependency (Redis/SQLite
// optional later); this is enough for a personal / small-deploy service.

const fs = require('fs');
const path = require('path');

const TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 days
const mem = new Map();

// On serverless hosts the filesystem may be read-only except /tmp. Detect and
// degrade gracefully to memory-only.
const CACHE_DIR = path.join(process.cwd(), '.cache');
let diskOk = true;
try {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
} catch {
  diskOk = false;
}

function keyToFile(key) {
  const safe = key.replace(/[^a-z0-9._-]/gi, '_').slice(0, 120);
  return path.join(CACHE_DIR, `${safe}.json`);
}

function get(key) {
  const now = Date.now();
  const m = mem.get(key);
  if (m && now - m.at < TTL_MS) return m.value;

  if (diskOk) {
    try {
      const raw = fs.readFileSync(keyToFile(key), 'utf8');
      const parsed = JSON.parse(raw);
      if (parsed && now - parsed.at < TTL_MS) {
        mem.set(key, parsed);
        return parsed.value;
      }
    } catch {
      /* miss */
    }
  }
  return null;
}

function set(key, value) {
  const entry = { at: Date.now(), value };
  mem.set(key, entry);
  if (diskOk) {
    try {
      fs.writeFileSync(keyToFile(key), JSON.stringify(entry));
    } catch {
      /* ignore write failures (read-only fs) */
    }
  }
}

module.exports = { get, set, TTL_MS };

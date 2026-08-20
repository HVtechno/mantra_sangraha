// scripts/build-audio-index.cjs
// ONE-TIME (re-runnable) builder for lib/audioIndex.json — a pre-resolved map of
// mantra slug -> archive.org recitation URL(s). Run it from your OWN machine (a
// residential IP), NOT the server: archive.org rate-limits datacenter IPs but is
// fine with a slow trickle from a home connection.
//
//   node scripts/build-audio-index.cjs
//
// It is SLOW ON PURPOSE (a pause between requests + retry/backoff) so archive.org
// doesn't throttle it, and RESUMABLE — it writes after every mantra and skips
// ones already resolved, so if it stalls, just run it again and it continues.
// Mantras that resolved to nothing are stored as [] and WILL be retried on the
// next run (so after you add aliases below, just re-run — only the empty ones
// get retried). The result is tiny (a JSON of URLs), legal (we link, never
// rehost), and removes the fragile live search from the running app.
//
// NAME MISMATCHES: archive.org files recitations under many spellings/sub-names
// ("Totakashtakam" is "thotakashtakam"; "Mahishasura Mardini" is "Aigiri
// Nandini"). So for each mantra we try, in order: its name, anything in/out of
// its parentheses, then its catalog aliases (which already include the opening
// words — how most recitations are actually titled). First hit wins. To fix a
// still-"none" mantra, add the right spelling to its `aliases` in lib/aliases.js
// and re-run.

const fs = require('fs');
const path = require('path');
const aliases = require('../lib/aliases');
const audio = require('../lib/audioSearch');

const OUT = path.join(__dirname, '..', 'lib', 'audioIndex.json');
const OVERRIDES = path.join(__dirname, '..', 'lib', 'audioOverrides.json');
const DELAY_MS = 2500;      // pause between requests
const ALT_FEEDS = 2;        // how many extra reciter feeds to store per mantra
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Manual pins: slug -> archive item id / details|download URL / direct .mp3 URL.
// Pins ALWAYS win and are re-resolved every run (see audioOverrides.json).
function loadOverrides() {
  let raw = {};
  try { raw = JSON.parse(fs.readFileSync(OVERRIDES, 'utf8')) || {}; } catch { return {}; }
  const out = {};
  for (const k of Object.keys(raw)) if (!k.startsWith('_') && raw[k]) out[k] = raw[k];
  return out;
}

// Turn a pin value into a feed {url,title,sourceUrl,itemId}, or null.
async function resolveOverride(ov, name) {
  const s = String(ov || '').trim();
  if (!s) return null;
  // direct .mp3 download URL — usable as-is, no metadata call needed
  const dl = /archive\.org\/download\/([^/?#]+)\/(.+?\.mp3)(?:[?#].*)?$/i.exec(s);
  if (dl) {
    const id = decodeURIComponent(dl[1]);
    const file = decodeURIComponent(dl[2].split('/').pop()).replace(/\.mp3$/i, '');
    return { url: s.split('#')[0], title: file || id, sourceUrl: `https://archive.org/details/${id}`, itemId: id };
  }
  // details/download/metadata URL, or a bare item id -> pick the best track in it
  let id = s;
  const m = /archive\.org\/(?:details|download|metadata)\/([^/?#]+)/i.exec(s);
  if (m) id = decodeURIComponent(m[1]);
  const r = await withRetry(() => audio.findItem(id, name), `override ${id}`);
  if (r && r.ok && r.url) return { url: r.url, title: r.title, sourceUrl: r.sourceUrl, itemId: r.itemId };
  return null;
}

async function withRetry(fn, label) {
  for (let attempt = 1; attempt <= 4; attempt++) {
    try { return await fn(); }
    catch (e) {
      const wait = DELAY_MS * attempt * 2;
      console.log(`   … retry ${attempt}/4 for ${label} after ${wait}ms (${e.message})`);
      await sleep(wait);
    }
  }
  return null;
}

// Ordered search phrases for one mantra: name → parenthetical sub-name(s) →
// aliases (incipits/spellings). Deduped; very short tokens dropped.
function queriesFor(rec) {
  const out = [];
  const seen = new Set();
  const push = (s) => {
    s = String(s || '').trim();
    const k = s.toLowerCase();
    if (s && !seen.has(k)) { seen.add(k); out.push(s); }
  };
  push(rec.name);
  const m = /^(.*?)\s*\(([^)]+)\)\s*$/.exec(rec.name || '');
  if (m) { push(m[2]); push(m[1]); } // "X (Y)" -> also try "Y", then "X"
  for (const a of (rec.aliases || [])) {
    if (String(a).replace(/[^\p{L}\p{N}]/gu, '').length >= 5) push(a);
  }
  return out;
}

(async () => {
  let index = {};
  try { index = JSON.parse(fs.readFileSync(OUT, 'utf8')) || {}; } catch { index = {}; }

  const items = aliases.CATALOG;
  const overrides = loadOverrides();
  const nPins = Object.keys(overrides).length;
  console.log(`Building audio index for ${items.length} mantras → ${OUT}${nPins ? ` (${nPins} pinned override${nPins > 1 ? 's' : ''})` : ''}`);
  let added = 0, i = 0;

  for (const rec of items) {
    i++;
    const ov = overrides[rec.slug];
    // Skip only when NOT pinned and already resolved. Pins are re-resolved every run.
    if (!ov && index[rec.slug] && index[rec.slug].length) { console.log(`[${i}/${items.length}] skip ${rec.slug} (have ${index[rec.slug].length})`); continue; }
    process.stdout.write(`[${i}/${items.length}] ${rec.name}${ov ? ' (pinned)' : ''} … `);

    // 1) A pinned override wins outright. The value may be a single pin or an
    //    ARRAY of pins — each becomes a feed, in order (so "another voice" cycles
    //    through exactly the tracks you listed).
    if (ov) {
      const pins = Array.isArray(ov) ? ov : [ov];
      const feeds = [];
      for (const p of pins) {
        const f = await resolveOverride(p, rec.name);
        if (f && f.url && !feeds.some((x) => x.url === f.url)) feeds.push(f);
        await sleep(DELAY_MS);
      }
      if (feeds.length) {
        index[rec.slug] = feeds; // pinned feeds are authoritative, in listed order
        added++;
        console.log(`OK pinned: ${feeds.length} feed(s) — ${feeds.map((f) => f.title).join(' · ')}`);
        fs.writeFileSync(OUT, JSON.stringify(index));
        continue;
      }
      // A pinned slug must NEVER fall back to a generic search (that's how the
      // wrong recording — e.g. a discourse — sneaks back in). Leave it for the
      // next run; keep any previously-resolved value rather than overwriting it.
      console.log('pin unresolved (archive.org busy?) — kept for retry, not searched');
      if (!index[rec.slug]) index[rec.slug] = [];
      fs.writeFileSync(OUT, JSON.stringify(index));
      await sleep(DELAY_MS);
      continue;
    }

    // 2) Try each query phrase until one resolves to a real mp3.
    let res = null, usedQ = rec.name;
    for (const q of queriesFor(rec)) {
      const r = await withRetry(() => audio.find(q), `${rec.slug} "${q}"`);
      if (r && r.ok && r.url) { res = r; usedQ = q; break; }
      await sleep(DELAY_MS);
    }
    if (!res) { console.log('none'); index[rec.slug] = index[rec.slug] || []; fs.writeFileSync(OUT, JSON.stringify(index)); await sleep(DELAY_MS); continue; }

    const feeds = [{ url: res.url, title: res.title, sourceUrl: res.sourceUrl, itemId: res.itemId }];
    // resolve a couple of alternate reciter feeds to URLs too (multiple feeds/mantra)
    for (const alt of (res.alternatives || []).filter((a) => a.itemId !== res.itemId).slice(0, ALT_FEEDS)) {
      await sleep(DELAY_MS);
      const r = await withRetry(() => audio.findItem(alt.itemId, usedQ), alt.itemId);
      if (r && r.ok && r.url && !feeds.some((f) => f.url === r.url)) feeds.push({ url: r.url, title: r.title, sourceUrl: r.sourceUrl, itemId: r.itemId });
    }
    index[rec.slug] = feeds;
    added++;
    console.log(`OK — ${feeds.length} feed(s) via "${usedQ}": ${res.title}`);
    fs.writeFileSync(OUT, JSON.stringify(index)); // save after each (resumable)
    await sleep(DELAY_MS);
  }

  const withAudio = Object.keys(index).filter((k) => index[k].length).length;
  console.log(`\nDone. ${added} newly resolved · ${withAudio} mantras with audio · ${Object.keys(index).length} total entries.`);
  console.log('Commit lib/audioIndex.json and deploy — the app will now serve these URLs without any live search.');
})();

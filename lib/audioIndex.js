// lib/audioIndex.js
// Reads the pre-resolved recitation URLs from audioIndex.json (built once by
// scripts/build-audio-index.cjs). Runtime looks up by slug and returns URL(s)
// with NO live archive.org search — that's what removes the "temporarily
// unavailable" failures. Playback still streams the file from archive's CDN
// (client-side, reliable); only the fragile server-side SEARCH is bypassed.
//
// audioIndex.json is required (bundled) so it ships with the deploy; an empty
// {} placeholder is committed until you run the builder.

let INDEX = {};
try { INDEX = require('./audioIndex.json') || {}; } catch { INDEX = {}; }

// Returns [{ url, title, sourceUrl, itemId }, ...] for a slug, or null.
function getIndexed(slug) {
  const list = slug && INDEX[slug];
  return Array.isArray(list) && list.length ? list : null;
}

function indexSize() { return Object.keys(INDEX).filter((k) => Array.isArray(INDEX[k]) && INDEX[k].length).length; }

module.exports = { getIndexed, indexSize };

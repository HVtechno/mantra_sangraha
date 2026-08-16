import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { parseDocument } = require('../lib/parse.js');
const sd = require('../lib/sources/sanskritdocuments.js');

const here = dirname(fileURLToPath(import.meta.url));
const fixture = join(here, '..', 'fixtures', 'lingashtakam.sanskritdocuments.txt');

test('sanskritdocuments Lingashtakam page parses to 8 verses, chrome dropped', () => {
  const raw = readFileSync(fixture, 'utf8');
  const r = parseDocument(raw, 'devanagari');
  const numbered = r.verses.filter((v) => /^\d+$/.test(v.n)).map((v) => Number(v.n));
  assert.deepEqual(numbered, [1, 2, 3, 4, 5, 6, 7, 8], 'eight numbered verses (१..८)');
  for (const v of r.verses) {
    assert.doesNotMatch(v.text, /sanskritdocuments|Home|PDF|volunteers|Srinivas/i, 'no site chrome in verses');
  }
  const v1 = r.verses.find((v) => v.n === '1');
  assert.match(v1.text, /ब्रह्ममुरारि/, 'verse 1 begins ब्रह्ममुरारि…');
});

test('sanskritdocuments adapter: Devanagari-only, curated slug map', async () => {
  // declines non-devanagari scripts (Devanagari-only source)
  const nonDeva = await sd.fetchBySlug('lingashtakam', {}, 'tamil');
  assert.equal(nonDeva.ok, false);
  // unmapped slug -> no attempt
  const unmapped = await sd.fetchBySlug('some-unknown-mantra', {}, 'devanagari');
  assert.equal(unmapped.ok, false);
  assert.equal(sd.candidateUrls('some-unknown-mantra').length, 0);
  // mapped slug -> a real sanskritdocuments URL
  assert.match(sd.candidateUrls('lingashtakam')[0], /sanskritdocuments\.org\/doc_shiva\/lingashh\.html$/);
});

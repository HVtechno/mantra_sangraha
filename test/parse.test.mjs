import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { parseDocument } = require('../lib/parse.js');

const here = dirname(fileURLToPath(import.meta.url));
const fixture = join(here, '..', 'fixtures', 'soundarya-lahari.devanagari.body.txt');

test('Soundarya Lahari: all 100 verses + 3 anubandha parse and number correctly', () => {
  const raw = readFileSync(fixture, 'utf8');
  const r = parseDocument(raw);

  const numbered = r.verses.filter((v) => /^\d+$/.test(v.n)).map((v) => Number(v.n));
  assert.equal(numbered.length, 103, 'expected 103 numbered verses');
  assert.equal(Math.max(...numbered), 103, 'highest verse number should be 103');

  const missing = [];
  for (let i = 1; i <= 103; i++) if (!numbered.includes(i)) missing.push(i);
  assert.deepEqual(missing, [], `no gaps in verse numbers (missing: ${missing})`);

  // spot-check content
  const v1 = r.verses.find((v) => v.n === '1');
  assert.match(v1.text, /शिवः शक्त्या/, 'verse 1 begins शिवः शक्त्या…');
  const v100 = r.verses.find((v) => v.n === '100');
  assert.match(v100.text, /प्रदीपज्वालाभि/, 'verse 100 begins प्रदीपज्वालाभि…');
});

test('parser drops site chrome (no English nav / URLs leak into verses)', () => {
  const raw = readFileSync(fixture, 'utf8');
  const r = parseDocument(raw);
  for (const v of r.verses) {
    assert.doesNotMatch(v.text, /vignanam\.org|Browse Related|View this in/i,
      `verse ${v.n} should not contain site chrome`);
  }
});

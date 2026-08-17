import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const ws = require('../lib/sources/websearch.js');
const { safeUrl, rankCandidates, bestParse } = ws;

test('safeUrl blocks non-http and private/internal hosts', () => {
  assert.equal(safeUrl('https://ta.wikisource.org/wiki/x'), true);
  assert.equal(safeUrl('http://example.com/a'), true);
  assert.equal(safeUrl('file:///etc/passwd'), false);
  assert.equal(safeUrl('http://localhost:3000/api'), false);
  assert.equal(safeUrl('http://127.0.0.1/'), false);
  assert.equal(safeUrl('http://10.0.0.5/'), false);
  assert.equal(safeUrl('http://192.168.1.1/'), false);
  assert.equal(safeUrl('http://169.254.169.254/latest/meta-data'), false);
  assert.equal(safeUrl('http://172.16.0.1/'), false);
});

test('rankCandidates drops junk domains and boosts trusted sources', () => {
  const results = [
    { link: 'https://youtube.com/watch?v=1', title: 'Sivapuranam song', snippet: '' },
    { link: 'https://ta.wikisource.org/wiki/Sivapuranam', title: 'Sivapuranam text', snippet: 'lyrics' },
    { link: 'https://randomblog.com/sivapuranam', title: 'Sivapuranam lyrics', snippet: '' },
  ];
  const ranked = rankCandidates(results, 'Sivapuranam');
  assert.ok(!ranked.some((r) => /youtube/.test(r.link)));           // junk dropped
  assert.equal(ranked[0].link, 'https://ta.wikisource.org/wiki/Sivapuranam'); // trusted first
});

test('bestParse detects the dominant Indic script regardless of the requested one', () => {
  // A Tamil page requested under 'devanagari' should still parse as Tamil.
  const tamilHtml = '<html><body><p>நமச்சிவாய வாஅழ்க நாதன்தாள் வாழ்க</p><p>இமைப்பொழுதும் என்நெஞ்சில் நீங்காதான் தாள்வாழ்க</p></body></html>';
  const { script, len } = bestParse(tamilHtml, 'devanagari');
  assert.equal(script, 'tamil');
  assert.ok(len > 0);
});

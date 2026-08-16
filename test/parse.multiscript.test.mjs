import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { parseDocument, parseMeanings } = require('../lib/parse.js');
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const here = dirname(fileURLToPath(import.meta.url));

// A tiny synthetic "vignanam-style" Tamil page: English chrome + Tamil verses
// separated by the same ॥ n ॥ markers the source uses across scripts.
const TAMIL_HTML = `
<div class="nav">Vaidika Vignanam</div>
<a>Meaning</a><a>Multimedia</a>
View this in: English | Devanagari | Tamil
<div class="content">
சிவꞌ சக்த்யா யுக்தோ யதி பவதி சக்தꞌ ப்ரபவிதும்
ந சேதேவம் தேவோ ந கலு குசலꞌ ஸ்பந்திதுமபி ॥ 1 ॥
தனீயாம்ஸம் பாம்ஸும் தவ சரணபங்கேருஹபவம்
விரிஞ்சிஸ்ஸஞ்சின்வன் விரசயதி லோகானவிகலம் ॥ 2 ॥
</div>
Browse Related Categories:
<a>சிவ பஞ்சாக்ஷர ஸ்தோத்திரம்</a>
`;

test('parser handles Tamil script (keeps Tamil, drops English chrome, splits on ॥ n ॥)', () => {
  const r = parseDocument(TAMIL_HTML, 'tamil');
  const numbered = r.verses.filter((v) => /^\d+$/.test(v.n)).map((v) => Number(v.n));
  assert.deepEqual(numbered, [1, 2], 'two Tamil verses, numbered 1 and 2');
  for (const v of r.verses) {
    assert.doesNotMatch(v.text, /Vaidika|Meaning|View this in|Browse Related|English/i, 'no English chrome in verses');
    assert.match(v.text, /[஀-௿]/, 'verse text is Tamil script');
  }
});

test('unknown script falls back to devanagari range without crashing', () => {
  const r = parseDocument('कोई पाठ नहीं ॥ 1 ॥', 'klingon');
  assert.equal(r.numberedCount, 1);
});

test('Vedic prose (Rudram-style): anuvaka 1 stays whole, not carved into a fake invocation', () => {
  // Anuvaka 1 has several internal ॥ before ॥ 1 ॥ — must not be split.
  const html = `<div>
  नमस्ते रुद्र मन्यव उतोत इषवे नमः ॥
  नमस्ते अस्तु धन्वने बाहुभ्यामुत ते नमः ॥
  अथो य इषुधिस्तवारे अस्मन्निधेहि तम् ॥ 1 ॥
  श्री शम्भवे नमः ॥ नमस्ते अस्तु भगवन् ॥ 2 ॥
  </div>`;
  const r = parseDocument(html, 'devanagari');
  const numbered = r.verses.filter((v) => /^\d+$/.test(v.n)).map((v) => Number(v.n));
  assert.deepEqual(numbered, [1, 2]);
  assert.ok(!r.verses.some((v) => v.invocation), 'no fake invocation page');
  const v1 = r.verses.find((v) => v.n === '1');
  assert.match(v1.text, /मन्यव/, 'verse 1 keeps the first mantra of the anuvaka');
  assert.match(v1.text, /अस्मन्निधेहि/, 'verse 1 also keeps the last mantra of the anuvaka');
});

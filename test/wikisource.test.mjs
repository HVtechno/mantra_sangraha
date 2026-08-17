import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const wiki = require('../lib/sources/wikisource.js');
const { editionsFor, bestTitle, mappedEntry } = wiki;

test('curated pointer map resolves a romanised name to the exact Wikisource page', () => {
  const m = mappedEntry('Sivapuranam', 'sivapuranam');
  assert.equal(m.wiki, 'ta');
  assert.equal(m.script, 'tamil');
  assert.ok(m.title.includes('சிவ')); // native-script Tamil title
  assert.equal(mappedEntry('random text', 'random-text'), null);
});

test('editionsFor maps a text script to Wikisource language edition(s)', () => {
  assert.deepEqual(editionsFor('tamil'), ['ta']);
  assert.deepEqual(editionsFor('telugu'), ['te']);
  assert.deepEqual(editionsFor('devanagari'), ['sa', 'hi']);
  assert.deepEqual(editionsFor('hindi'), ['hi', 'sa']);
  assert.deepEqual(editionsFor('unknown'), ['sa']); // safe default
});

test('bestTitle matches when the query shares tokens with the title', () => {
  const results = [
    { title: 'Shiva Purana Overview' },
    { title: 'Sri Sivapuranam Stotram' },
    { title: 'Something Else' },
  ];
  assert.equal(bestTitle('Sivapuranam', results).title, 'Sri Sivapuranam Stotram');
});

test('KNOWN LIMIT: a romanised query cannot rank native-script titles — falls back to the search engine top hit', () => {
  // "sivapuranam" (Latin) shares no substring with Tamil-script titles, so the
  // picker can only defer to Wikisource search order (returns the first result).
  const nativeResults = [
    { title: 'திருவாசகம்/சிவபுராணம்' },
    { title: 'சிவபுராண வரலாறு' },
  ];
  assert.equal(bestTitle('Sivapuranam', nativeResults).title, 'திருவாசகம்/சிவபுராணம்');
  assert.equal(bestTitle('anything', []), null);
});

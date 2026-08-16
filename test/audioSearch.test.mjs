import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const audio = require('../lib/audioSearch.js');
const { scoreDoc, rankDocs, pickMp3, downloadUrl, deCamel } = audio;

test('downloadUrl encodes the id and file (spaces, slashes)', () => {
  assert.equal(
    downloadUrl('MyItem', 'Sri Adi - Soundarya lahari.mp3'),
    'https://archive.org/download/MyItem/Sri%20Adi%20-%20Soundarya%20lahari.mp3'
  );
});

test('pickMp3 picks the track that matches the mantra name in a multi-track album', () => {
  // The real bug: "19-sri-lalita-sahasranama-stotram" is an album; the old
  // shortest-file rule grabbed "05 Medha Sooktham" (1:12) instead of the
  // actual 43-min Lalita Sahasranama track.
  const album = [
    { name: 'cover.png', format: 'PNG' },
    { name: '05 Medha Sooktham.mp3', format: 'VBR MP3', length: '72' },
    { name: '19 Sri Lalita Sahasranama Stotram.mp3', format: 'VBR MP3', length: '2616' },
    { name: '02 Ganesha Pancharatnam.mp3', format: 'VBR MP3', length: '300' },
  ];
  const p = pickMp3(album, 'lalita sahasranama stotram');
  assert.equal(p.name, '19 Sri Lalita Sahasranama Stotram.mp3');
  assert.ok(p.match >= 0.5);
});

test('pickMp3 falls back to the longest track when no filename matches, ignores non-audio', () => {
  const files = [
    { name: 'cover.png', format: 'PNG' },
    { name: 'track01.mp3', format: 'VBR MP3', length: '120' },
    { name: 'track02.mp3', format: 'VBR MP3', length: '900' }, // longest → the recitation
  ];
  assert.equal(pickMp3(files, 'something unmatched').name, 'track02.mp3');
  assert.equal(pickMp3([{ name: 'x.png', format: 'PNG' }], 'x'), null);
});

test('scoreDoc: recitation ranks above lecture; non-match scores zero', () => {
  const name = 'lingashtakam';
  const recitation = { identifier: 'a', title: 'Lingashtakam Stotram (recitation)', downloads: 5000 };
  const lecture = { identifier: 'b', title: 'Lingashtakam meaning - discourse Part 3', downloads: 200 };
  const unrelated = { identifier: 'c', title: 'Venkatesa Suprabhatam', downloads: 9000 };
  assert.ok(scoreDoc(name, recitation) > scoreDoc(name, lecture));
  assert.equal(scoreDoc(name, unrelated), 0);
});

test('scoring works when archive returns NO title (identifier only)', () => {
  // Real case: "Vishnu sahasranama stotram" search returns docs with only an
  // identifier and no title/downloads. Scoring must still find them.
  const docs = [
    { identifier: '20191110_20191110_1908' },                                  // date-only, no name
    { identifier: 'VishnuSahasranamaStotramByKakinadaJeeyar' },
    { identifier: 'sri-vishnu-sahasranama-stotram-chanting-swami-omkarananda' },
    { identifier: 'SriVishnuSahasranamaStotramtrimatacharyaBhashyamWithTeluguMeaning' }, // has "meaning"
  ];
  const ranked = rankDocs('vishnu sahasranama stotram', docs);
  assert.ok(ranked.length >= 2, `expected matches from identifiers, got ${ranked.length}`);
  // the plain "chanting" recitation should outrank the "...With Telugu Meaning" discourse
  const chanting = ranked.find((r) => /omkarananda/.test(r.identifier));
  const meaning = ranked.find((r) => /TeluguMeaning/.test(r.identifier));
  assert.ok(chanting && meaning && chanting.score > meaning.score);
  // the date-only identifier must be dropped
  assert.ok(!ranked.some((r) => r.identifier === '20191110_20191110_1908'));
});

test('deCamel splits CamelCase and separators into words', () => {
  assert.equal(deCamel('VishnuSahasranamaStotram'), 'Vishnu Sahasranama Stotram');
  assert.equal(deCamel('sri-vishnu-sahasranama-stotram'), 'sri vishnu sahasranama stotram');
});

test('rankDocs orders by score and drops non-matches', () => {
  const ranked = rankDocs('bhaja govindam', [
    { identifier: 'lec', title: 'Bhaja Govindam class day 12 lecture', downloads: 100 },
    { identifier: 'rec', title: 'Bhaja Govindam - Stotram recitation', downloads: 3000 },
    { identifier: 'nope', title: 'Completely different chant', downloads: 1 },
  ]);
  assert.equal(ranked[0].identifier, 'rec');
  assert.ok(!ranked.some((r) => r.identifier === 'nope'));
});

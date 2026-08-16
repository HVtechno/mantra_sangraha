import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const catalog = require('../lib/catalog.js');
const aliases = require('../lib/aliases.js');

const {
  extractLocs, isSitemapIndex, slugFromLoc, indexFromLocs, titleize,
  searchIndex, bestMatch, levRatio,
} = catalog;

// vignanam's real sitemap uses RELATIVE locs (no scheme/host, no leading slash),
// with bare landing pages ("devanagari.html") mixed in. We also accept absolute
// URLs, so the fixture covers both.
const SITEMAP = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>index.html</loc></url>
  <url><loc>devanagari.html</loc></url>
  <url><loc>telugu.html</loc></url>
  <url><loc>english/venkateswara-stotram.html</loc></url>
  <url><loc>devanagari/venkateswara-stotram.html</loc></url>
  <url><loc>english/navadurga-stotram.html</loc></url>
  <url><loc>english/isavasya-upanishad.html</loc></url>
  <url><loc>english/nitya-sandhya-vandanam.html</loc></url>
  <url><loc>media/konkani/nitya-sandhya-vandanam.html</loc></url>
  <url><loc>veda/nitya-sandhya-vandanam-devanagari.html</loc></url>
  <url><loc>https://www.vignanam.org/english/kena-upanishad.html</loc></url>
  <url><loc>authors/adi-shankaracharya.html</loc></url>
</urlset>`;

test('sitemap: extract <loc> entries and detect urlset vs index', () => {
  assert.equal(extractLocs(SITEMAP).length, 12);
  assert.equal(isSitemapIndex(SITEMAP), false);
  assert.equal(isSitemapIndex('<sitemapindex><sitemap><loc>x</loc></sitemap></sitemapindex>'), true);
});

test('slugFromLoc: relative + absolute <lang>/<slug>.html only', () => {
  // relative loc (the real sitemap format)
  assert.deepEqual(
    slugFromLoc('english/venkateswara-stotram.html'),
    { slug: 'venkateswara-stotram', name: 'Venkateswara Stotram' }
  );
  // absolute URL and leading slash also accepted
  assert.deepEqual(slugFromLoc('https://www.vignanam.org/english/kena-upanishad.html').slug, 'kena-upanishad');
  assert.equal(slugFromLoc('/devanagari/navadurga-stotram.html').slug, 'navadurga-stotram');
  // bare landing pages, nested media paths, non-lang dirs are rejected
  assert.equal(slugFromLoc('devanagari.html'), null);
  assert.equal(slugFromLoc('index.html'), null);
  assert.equal(slugFromLoc('media/konkani/nitya-sandhya-vandanam.html'), null);
  assert.equal(slugFromLoc('veda/nitya-sandhya-vandanam-devanagari.html'), null);
  assert.equal(slugFromLoc('authors/adi-shankaracharya.html'), null);
});

test('indexFromLocs: dedupes one slug across scripts, drops landing pages', () => {
  const idx = indexFromLocs(extractLocs(SITEMAP));
  assert.deepEqual(idx.map((e) => e.slug).sort(), [
    'isavasya-upanishad', 'kena-upanishad', 'navadurga-stotram',
    'nitya-sandhya-vandanam', 'venkateswara-stotram',
  ]);
});

test('searchIndex: a broad category word surfaces matching pages', () => {
  const idx = indexFromLocs(extractLocs(SITEMAP));
  const slugs = searchIndex(idx, 'upanishad').map((e) => e.slug);
  assert.ok(slugs.includes('isavasya-upanishad') && slugs.includes('kena-upanishad'),
    `expected upanishad pages, got ${slugs}`);
});

test('titleize turns a slug into a readable name', () => {
  assert.equal(titleize('sri-rudram-namakam'), 'Sri Rudram Namakam');
});

test('searchIndex ranks the intended stotra first', () => {
  const idx = indexFromLocs(extractLocs(SITEMAP));
  assert.equal(searchIndex(idx, 'venkateswara')[0].slug, 'venkateswara-stotram');
  assert.equal(searchIndex(idx, 'navad')[0].slug, 'navadurga-stotram');
  assert.equal(searchIndex(idx, 'sandhya vandanam')[0].slug, 'nitya-sandhya-vandanam');
});

test('bestMatch auto-resolves confident hits (incl. small typos) and rejects noise', () => {
  const idx = indexFromLocs(extractLocs(SITEMAP));
  assert.equal(bestMatch(idx, 'venkateswara stotram').slug, 'venkateswara-stotram');
  assert.equal(bestMatch(idx, 'venkateshwara stotram').slug, 'venkateswara-stotram'); // typo
  assert.equal(bestMatch(idx, 'navadurga stotra').slug, 'navadurga-stotram');          // partial
  assert.equal(bestMatch(idx, 'zzzxqq nonsense'), null);
  assert.ok(levRatio('venkateshwara', 'venkateswara') > 0.84);
});

test('curated aliases still resolve without the network index', () => {
  assert.equal(aliases.resolve('sandhyavandhanam').slug, 'nitya-sandhya-vandanam');
  assert.equal(aliases.resolve('aigiri nandini').slug, 'sri-mahishasura-mardini-stotram-ayigiri-nandini');
});

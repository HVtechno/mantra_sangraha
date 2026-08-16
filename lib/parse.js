// lib/parse.js
// Turns fetched stotra HTML (or already-stripped text) into clean, numbered
// Devanagari verses. Zero external dependencies — regex-based, so it runs in
// any Node/Next runtime and is trivially unit-testable.
//
// The strategy is DOM-independent on purpose: we strip markup to plain text and
// then split on the verse-number markers ( ॥ N ॥ ) that every traditional
// stotra text uses. That makes the parser resilient to the exact HTML the
// source site happens to emit.

const DANDA = '॥'; // ॥  double danda
const SINGLE_DANDA = '।'; // ।

// --- 1. Markup / boilerplate stripping ------------------------------------

function decodeEntities(s) {
  return s
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => {
      try { return String.fromCodePoint(parseInt(n, 10)); } catch { return _; }
    })
    .replace(/&#x([0-9a-fA-F]+);/g, (_, n) => {
      try { return String.fromCodePoint(parseInt(n, 16)); } catch { return _; }
    });
}

/**
 * Convert raw HTML (or markdown-ish text) into newline-separated plain text.
 */
function stripMarkup(input) {
  let t = String(input || '');

  // Drop script/style blocks entirely.
  t = t.replace(/<script[\s\S]*?<\/script>/gi, ' ');
  t = t.replace(/<style[\s\S]*?<\/style>/gi, ' ');
  t = t.replace(/<!--[\s\S]*?-->/g, ' ');

  // Turn line-ish tags into newlines so verses keep their shape.
  t = t.replace(/<\s*(br|\/p|\/div|\/li|\/h[1-6]|\/tr|hr)\s*\/?\s*>/gi, '\n');
  t = t.replace(/<\s*(p|div|li|h[1-6]|tr)(\s[^>]*)?>/gi, '\n');

  // Remove any remaining tags.
  t = t.replace(/<[^>]+>/g, ' ');

  // Strip markdown link syntax [text](url) -> text, and images ![alt](url) -> ''
  t = t.replace(/!\[[^\]]*\]\([^)]*\)/g, ' ');
  t = t.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1');
  // Strip markdown bold/italic markers but keep the words.
  t = t.replace(/\*\*/g, '').replace(/(^|\s)[*_]{1,3}(\S)/g, '$1$2');

  t = decodeEntities(t);

  // Strip leading markdown list bullets ("- ", "* ") at the start of lines.
  t = t.replace(/^[ \t]*[-*][ \t]+/gm, '');

  // Normalise whitespace: collapse runs of spaces/tabs, keep newlines.
  t = t.replace(/\r/g, '');
  t = t.replace(/[ \t ]+/g, ' ');
  t = t.replace(/\n{3,}/g, '\n\n');
  return t;
}

// Lines that are site chrome, never part of a stotra.
const BOILERPLATE_LINE = [
  /vaidika vignanam/i,
  /collection of spiritual/i,
  /^meaning\b/i,
  /^multimedia\b/i,
  /^view this in/i,
  /this document is in .*anusvaras/i,
  /^browse related categories/i,
  /^content-type:/i,
  /^→\s*https?:/i,
  /^https?:\/\//i,
  /^-+\s*$/,
  /^\|/, // pipe-separated language nav rows
];

// A line is "content" if it contains characters from the target Indic script.
// Unicode blocks per script the source (vignanam.org) publishes.
const SCRIPTS = {
  devanagari: /[ऀ-ॿ]/,
  tamil: /[஀-௿]/,
  telugu: /[ఀ-౿]/,
  kannada: /[ಀ-೿]/,
  malayalam: /[ഀ-ൿ]/,
  bengali: /[ঀ-৿]/,
  gujarati: /[઀-૿]/,
  odia: /[଀-୿]/,
};
const DEVANAGARI = SCRIPTS.devanagari;
function scriptRegex(name) { return SCRIPTS[name] || DEVANAGARI; }

/**
 * Cut away everything after the related-links footer and drop chrome lines.
 * `scriptRe` decides which script's characters count as content.
 */
function isolateBody(text, scriptRe = DEVANAGARI) {
  let t = text;

  // Hard stop at the related-categories footer if present.
  const footer = t.search(/browse related categories/i);
  if (footer !== -1) t = t.slice(0, footer);

  // Drop the YAML-ish frontmatter that web fetchers sometimes prepend
  // ( key: value lines between --- markers ). Only strip a leading block.
  t = t.replace(/^---[\s\S]*?\n---\n/, '\n');
  // Also drop stray leading "meta-...:" lines.
  t = t.replace(/^(?:[a-z][\w:-]*:\s.*\n)+/i, '\n');

  const kept = [];
  for (const rawLine of t.split('\n')) {
    const line = rawLine.trim();
    if (!line) { kept.push(''); continue; }
    if (BOILERPLATE_LINE.some((re) => re.test(line))) continue;
    // Drop "key: value" chrome (meta-og:..., canonical:, title:, etc.) even if
    // the value happens to contain Devanagari (search-engine description echoes).
    if (/^[a-z][\w.-]*(:[\w.-]+)?:\s/i.test(line)) continue;
    // The body of the stotra is in the target script. Anything with no such
    // characters at all is site chrome (English nav, URLs, blurbs) — drop it.
    if (!scriptRe.test(line)) continue;
    kept.push(line);
  }

  // Trim leading/trailing blank lines.
  return kept.join('\n').replace(/^\n+/, '').replace(/\n+$/, '').trim();
}

// --- 2. Verse splitting ----------------------------------------------------

// A verse-number marker: double danda, digits, double danda. Digits may be
// Arabic or any Indic script's digits (the source mostly uses Arabic even on
// Tamil/Telugu pages, but we accept all to be safe).
const VERSE_MARK = /॥\s*([0-9०-९௦-௯౦-౯೦-೯൦-൯০-৯૦-૯୦-୯]+)\s*॥/g;

// Bases of the "digit 0" code point for each supported script.
const DIGIT_BASES = [0x0966, 0x0be6, 0x0c66, 0x0ce6, 0x0d66, 0x09e6, 0x0ae6, 0x0b66];
function normDigits(s) {
  return String(s).replace(/[०-९௦-௯౦-౯೦-೯൦-൯০-৯૦-૯୦-୯]/g, (ch) => {
    const c = ch.codePointAt(0);
    for (const b of DIGIT_BASES) if (c >= b && c <= b + 9) return String(c - b);
    return ch;
  });
}

// Detect a section heading like "प्रथम भागः - आनन्द लहरी", "अथ ...", "... अध्यायः".
const SECTION_HINT = /(भाग|अध्याय|खण्ड|पटल|उल्लास|तरङ्ग|स्तबक|दशक|अथ\s)/;
function looksLikeHeading(line) {
  const l = line.trim();
  if (!l || l.length > 80) return false;
  if (/[।॥]/.test(l)) return false; // has a danda -> it's verse text
  return SECTION_HINT.test(l);
}

function cleanVerseText(chunk) {
  return chunk
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .join('\n')
    .trim();
}

/**
 * Split isolated body text into verses.
 * Returns [{ n, text, section? }] where n is a display label (number, or "०"
 * for a leading unnumbered invocation).
 */
function splitVerses(body, scriptRe = DEVANAGARI) {
  const verses = [];
  let currentSection = null;

  // Pull section headings out first, remembering their character offset so we
  // can attach them to the verse that follows.
  const headings = [];
  {
    let offset = 0;
    for (const line of body.split('\n')) {
      if (looksLikeHeading(line)) headings.push({ at: offset, text: line.trim() });
      offset += line.length + 1;
    }
  }
  function sectionFor(startIdx, endIdx) {
    let sec = null;
    for (const h of headings) {
      if (h.at >= startIdx && h.at < endIdx) sec = h.text;
    }
    return sec;
  }

  let last = 0;
  let m;
  VERSE_MARK.lastIndex = 0;
  const marks = [];
  while ((m = VERSE_MARK.exec(body)) !== null) {
    marks.push({ num: normDigits(m[1]), start: m.index, end: VERSE_MARK.lastIndex });
  }

  if (marks.length === 0) {
    // No numbered markers — fall back to splitting on blank lines / double danda.
    const blocks = body.split(/\n{2,}/).map(cleanVerseText).filter((b) => scriptRe.test(b));
    return blocks.map((text, i) => ({ n: String(i + 1), text }));
  }

  for (let i = 0; i < marks.length; i++) {
    const mk = marks[i];
    const chunkStart = last;
    const chunkEnd = mk.start; // text before this number marker belongs to this verse
    let text = cleanVerseText(body.slice(chunkStart, chunkEnd));
    const sec = sectionFor(chunkStart, chunkEnd);
    if (sec) currentSection = sec;
    // Remove a heading line that may be embedded at the top of the chunk.
    text = text
      .split('\n')
      .filter((l) => !looksLikeHeading(l))
      .join('\n')
      .trim();

    // The very first chunk may contain a leading invocation with no number.
    if (i === 0) {
      // If there is an unnumbered invocation ending in a lone danda before the
      // real verse-1 text, emit it separately.
      const invMatch = text.match(/^([\s\S]*?॥)\s*(?=\S)/);
      // Heuristic: a leading dhyana/invocation is exactly one danda-terminated
      // unit before verse 1. Only split when there are EXACTLY two units — Vedic
      // prose (Rudram etc.) has many internal dandas in anuvaka 1 and must stay
      // whole, not be carved into a fake invocation.
      const parts = text.split(/॥/).map((s) => s.trim()).filter(Boolean);
      if (parts.length === 2) {
        const inv = parts.slice(0, parts.length - 1).join(' ' + DANDA + '\n') + ' ' + DANDA;
        const mainVerse = parts[parts.length - 1];
        verses.push({ n: '०', text: inv, section: currentSection || undefined, invocation: true });
        text = mainVerse;
      }
    }

    if (text && scriptRe.test(text)) {
      verses.push({ n: mk.num, text, section: currentSection || undefined });
    }
    last = mk.end;
  }

  // Trailing text after the last number marker (phala-sruti / colophon).
  const tail = cleanVerseText(body.slice(last));
  if (tail && scriptRe.test(tail)) {
    const tailClean = tail.split('\n').filter((l) => !looksLikeHeading(l)).join('\n').trim();
    if (tailClean) verses.push({ n: 'colophon', text: tailClean, colophon: true });
  }

  return verses;
}

/**
 * Full pipeline: raw fetched content -> { verses, verseCount }.
 */
function parseDocument(rawHtmlOrText, script = 'devanagari') {
  const scriptRe = scriptRegex(script);
  const text = stripMarkup(rawHtmlOrText);
  const body = isolateBody(text, scriptRe);
  const verses = splitVerses(body, scriptRe);
  const numbered = verses.filter((v) => /^\d+$/.test(v.n));
  return {
    verses,
    verseCount: verses.length,
    numberedCount: numbered.length,
    lastNumber: numbered.length ? Number(numbered[numbered.length - 1].n) : 0,
    script,
  };
}

/**
 * Parse a vignanam /meaning/ page into { verseNumber -> English meaning }.
 * These pages read: <verse in target script> ॥ N ॥ … Translation (भावार्थ): <English
 * meaning> <next verse …>. The meaning is the Latin text right after the label,
 * up to where the next verse's Indic script resumes.
 */
function parseMeanings(rawHtmlOrText) {
  let t = stripMarkup(rawHtmlOrText);
  const footer = t.search(/browse related categories/i);
  if (footer !== -1) t = t.slice(0, footer);

  const meanings = {};
  // Each translation label; we key the meaning to the verse number before it.
  const LABEL = /(?:Translation\s*)?\(?\s*भावार्थ\s*\)?\s*:?/g; // भावार्थ
  const anyIndic = /[ऀ-ॿঀ-৿஀-௿ఀ-೿ഀ-ൿ]/;
  const NUM = /॥\s*([0-9०-९]+)\s*॥/g;

  let m;
  while ((m = LABEL.exec(t)) !== null) {
    const labelEnd = LABEL.lastIndex;
    const before = t.slice(0, m.index);
    const nums = [...before.matchAll(NUM)];
    if (!nums.length) continue;
    const n = normDigits(nums[nums.length - 1][1]);

    // meaning = the Latin text after the label, up to where the next verse's
    // Indic script resumes.
    const rest = t.slice(labelEnd);
    const indic = rest.search(anyIndic);
    const cut = indic === -1 ? rest.length : indic;
    let meaning = rest.slice(0, cut).replace(/\s+/g, ' ').trim();
    meaning = meaning.replace(/Translation\s*\($/i, '').trim();
    if (meaning && meaning.length > 1) meanings[n] = meaning;
  }
  return meanings;
}

module.exports = { stripMarkup, isolateBody, splitVerses, parseDocument, parseMeanings, SCRIPTS };

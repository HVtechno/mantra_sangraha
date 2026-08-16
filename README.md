# Mantra Sangraha · मन्त्र संग्रह

An **ad-free, offline personal book of Hindu mantras & slokas**. Search a mantra by
name → the app fetches the clean Devanagari text on demand from open, public-domain
sources → add it to your own book (stored on your device) → read it offline in a
3D flip-book, with optional recitation audio.

Nothing is pre-stored as a big archive. Each reader builds their **own** book on
demand. The app is a fetch-and-compile bridge over public-domain stotra texts.

## Why it's legally clean

Ancient Sanskrit texts (Gayatri, Rudram, Soundarya Lahari, …) are public domain.
What is copyrighted are *modern translations, commentaries, particular typeset
editions, and audio recordings*. So this app sources only the raw Devanagari,
always shows the **source + attribution**, and for audio uses public-domain/CC
recordings, the user's own upload, or a legal YouTube embed (never a downloaded
recording).

## Stack

- **Next.js 14 (App Router), plain JavaScript, zero extra runtime deps.**
- Server-side fetch backend (required — the source sites block direct browser/CORS
  calls). The browser app only ever talks to our own API.

```
app/
  page.js                 UI: cinematic home, book grid, Bhava doorway, held foldable reader
  layout.js               metadata + Tabler icon webfont
  globals.css             cinematic "darshan" theme (Cinzel / Tiro Devanagari / Poppins)
  api/fetch/route.js      GET /api/fetch?mantra=<name>   -> clean verse JSON
  api/search/route.js     GET /api/search?q=<text>       -> catalog suggestions
lib/
  fetchMantra.js          orchestrator: resolve -> adapters -> cache (script-aware)
  aliases.js              spelling/alias normalisation + catalog
  feelings.js             curated feeling -> mantra map (Bhava doorway)
  i18n.js                 UI localisation (sa/hi/ta/te/kn/ml/en) + language -> script
  parse.js                markup strip + verse splitting (any Indic script)
  align.js                browser line-alignment (silence segmentation + even split)
  cache.js                in-memory + on-disk (./.cache) result cache
  sources/vignanam.js     Vaidika Vignanam adapter (more sources drop in here)
fixtures/ test/           parser + alignment fixtures and unit tests
```

## Design & navigation

Bright, cinematic "darshan" theme — a glowing Om with god-rays in the hero,
vibrant per-deity gradient cards, gold accents. It's responsive: a **bottom tab
bar on mobile** and a **left icon nav rail on web** (Home · Book · Bhava ·
Playing). The reader is a **held, foldable book** — two gilded-edged pages meeting
at a spine, a real page-turn animation, set inside the deity glow. Turn a phone
sideways for the full wide spread.

## Languages & scripts

On first run the app asks your language (default Sanskrit); you can change it
anytime from the globe button. The choice drives two things at once:

- **The mantra's script.** The source publishes every stotra in many scripts, so
  picking Tamil fetches `/tamil/<slug>.html`, Telugu `/telugu/…`, etc. The parser
  (`lib/parse.js`) is script-generalised (Unicode ranges + multi-script digits),
  so verses come through correctly numbered in that script.
- **The UI language.** All chrome is localised via `lib/i18n.js`
  (`sa · hi · ta · te · kn · ml · en`).

Translation status: English, Sanskrit and Hindi are complete and confident;
Tamil/Telugu/Kannada/Malayalam cover the short labels as a careful first pass and
longer helper sentences fall back to English — **worth a native speaker's review
before you call them final.** Also note: searching by typing the mantra *name in a
regional script* is not yet reliable (the catalog matches romanised names) — a
native-name index is future work.

## By feeling (bhava) — AI mood search + chant meditation

The "By feeling" tab is a separate space from your Book. You type how you feel in
your own words and an AI (`lib/mood.js` → `/api/mood`) matches **real mantras from
our catalog** — the model only *chooses by slug*; the sacred text is always
fetched from the source, never generated. No key? It falls back to keyword
matching, so it still works offline.

Tapping a match opens a **chant meditation**: the verse, a breathing circle, a
"chant 1…10" counter you tap through, the sourced meaning, recitation audio when
available, and a small "Save to Book" (the only Book interaction here). Framed as
a practice to steady the mind, never a medical remedy.

### Enabling the AI

Copy `.env.example` to `.env.local` and set `OPENAI_API_KEY`. Optional
`OPENAI_MODEL` (default `gpt-4o-mini`). Server-side only; the key is never sent to
the browser.

## Your book, its own table of contents

Each reader builds one personal book. When you add a mantra you file it under a
section (Veda, Stotra, Sloka, or your own). The reader shows an illuminated
**Table of Contents** on the left page that groups every mantra by section and
numbers it; tap any title and the right page flips to it. The book grows and
re-paginates itself as you add more. Everything lives in `localStorage`, so it
reads offline.

## Words that follow the chant (karaoke)

Attach a recitation (your own `.mp3` upload or a public-domain / CC audio URL),
press **Auto-sync words**, and the app aligns each line to the audio entirely in
your browser — it decodes the track, measures loudness, and uses the pauses
between lines as boundaries (`lib/align.js`). As it plays, the current line
lights up and the page turns to follow. When the pauses aren't clear it falls
back to an even split so the guide never breaks. YouTube embeds can't be synced
(no raw audio samples) — they still play as a fallback.

## Run it

```bash
npm install
npm run dev         # http://localhost:3000
```

Then type e.g. **Soundarya Lahari** and press Fetch — all 100 verses (plus the 3
anubandha verses) arrive in shuddha/plain Devanagari.

## Test

```bash
npm test            # verifies Soundarya Lahari parses to 103 numbered verses
```

## API

`GET /api/fetch?mantra=soundarya%20lahari` →

```json
{
  "ok": true,
  "id": "soundarya-lahari",
  "name": "Soundarya Lahari",
  "tradition": "Adi Shankaracharya",
  "deity": "Devi",
  "script": "devanagari",
  "source": "Vaidika Vignanam",
  "sourceUrl": "https://www.vignanam.org/devanagari/soundarya-lahari.html",
  "license": "Public-domain source text …",
  "lastNumber": 103,
  "verses": [ { "n": "1", "text": "शिवः शक्त्या…" }, … ]
}
```

## Sources

Primary adapter: **vignanam.org** (Vaidika Vignanam). The adapter chain in
`lib/fetchMantra.js` is designed so `sanskritdocuments.org`, `stotranidhi.com`,
etc. can be added as further adapters with the same `fetchBySlug(slug, meta)`
shape (Phase 2b).

## Roadmap

- **Phase 2 (this):** live fetch backend + wired app. ✅
- **Phase 2b:** more source adapters + fuller alias table.
- **Phase 3:** PWA (installable + true offline caching), optional accounts for
  cross-device sync, IndexedDB for saved audio.
- **Phase 4:** categories, transliteration + meaning toggle, community
  corrections, richer two-page drag-to-turn book, legally-clean audio library.

**Two rules we never break:** always show source + license; text accuracy is
sacred (a misspelled mantra is worse than none).

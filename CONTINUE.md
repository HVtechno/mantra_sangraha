# CONTINUE — Mantra Sangraha

A handoff so any new session can pick up exactly where we left off. Read this
top-to-bottom, then use the **Paste-this prompt** at the very bottom to restart.

Last updated: 2026-08-16 (full-site search resolver + ad-free archive.org audio
with karaoke + reader audio UX overhaul shipped).

---

## 0. Paste-this prompt (use this to restart a new session)

> We're building **Mantra Sangraha** — an ad-free Next.js web app where a user
> searches a Hindu mantra/sloka, the app fetches clean text on demand from open
> public-domain sources (in their chosen script), files it into a personal offline
> Book, and reads it in a cinematic held foldable-book reader with karaoke
> (sung line highlights, page turns to follow). A separate **Bhava** tab is an AI
> mood search → chant-meditation experience.
>
> Repo = my folder `D:\mantra_sangraha` (GitHub `HVtechno/mantra_sangraha`). It's
> far along and builds clean (`npm run build`, `npm test` = 25/25). DONE so far:
> live fetch backend + parser; **7-language UI + multi-script fetch** (sa/hi/ta/te/
> kn/ml/en); **cinematic "darshan" redesign** (hero, nav rail/tab bar, vibrant
> book grid); **held foldable reader** (tap/swipe to turn, book vs large mode,
> auto-turn, uniform font, TOC drawer); **line-synced karaoke** + follow on/off +
> line-nudge; **second source** sanskritdocuments (Devanagari fallback);
> **full-site search resolver** (`lib/catalog.js` harvests vignanam's whole
> sitemap so ANY stotra is searchable, not just curated aliases);
> **ad-free recitations from the Internet Archive** (`lib/audioSearch.js` +
> `/api/audio`: auto-finds a public-domain mp3, picks the right track, "another
> voice" shuffle, saved per mantra, feeds karaoke Auto-sync — NO YouTube ads);
> **Bhava = AI mood search** (`/api/mood`) + **chant meditation** (cinematic
> per-deity breathing emblem — NO forced count, open-ended; sourced meaning, synth
> tanpura drone w/ true mute + remembered mute, archive recitation w/ inline
> shuffle+save, Save-to-Book).
>
> Read `CONTINUE.md` fully, then `README.md`, `app/page.js`, `lib/catalog.js`,
> `lib/audioSearch.js`, `lib/parse.js`, `lib/i18n.js`. To enable the AI: copy
> `.env.example` → `.env.local` and set `OPENAI_API_KEY`.
>
> Open backlog (section 6): tap-along manual karaoke timing (the real fix for
> alignment drift); aartis/bhajans not on vignanam (e.g. "Om Jai Amba Gauri") —
> need a source (SOURCE DECISION PENDING); user-added mantra→feeling in Bhava;
> native-speaker review of ta/te/kn/ml strings; PWA. Ask me what to work on next.

---

## 1. What this app is (the vision)

A digital, ad-free, **offline** personal book of Hindu mantras and slokas. People
hunting for a full mantra today either sit through ad-heavy YouTube recitations or
get scattered fragments. Mantra Sangraha is a bridge: **search → fetch clean text
from open sources → file it into your own book under a section → read it offline,
beautifully typeset like a real prayer book, with recitation audio whose words
light up in time with the chant.**

Key principle: nothing is pre-stored as a big archive. Each visitor builds their
**own** book on demand. The app is a fetch-and-compile bridge over public-domain
texts.

## 2. Why it's legally clean (keep this discipline)

- Ancient Sanskrit texts (Gayatri, Rudram, Soundarya Lahari, etc.) are public
  domain — thousands of years old, no copyright on the text.
- What IS copyrighted: specific modern translations, commentaries, particular
  typeset editions, and audio recordings.
- So: source the raw Devanagari, **always show source + attribution**, and never
  rip a YouTube caption file or download a channel's audio.
- Audio rule (layered fallback): (1) public-domain/CC recording, or (2) the user's
  own upload, or (3) a legal YouTube embed (creator keeps views/credit). Never
  download/host someone's recording.

## 3. Decisions locked in

- **Stack:** Next.js 14 (App Router), **plain JavaScript**, zero extra runtime
  deps beyond next/react. Runs as a web service (user chose Next.js).
- **Fetch is server-side** (Next API routes) — the source sites block direct
  browser/CORS calls, so the browser only ever talks to our own `/api`.
- **Text:** Sanskrit Devanagari; prefer `/shuddha-devanagari/` (correct
  anusvaras) then `/devanagari/`.
- **Model:** on-demand fetch, per-user personal book, offline reading.
- **Book structure:** ONE personal book with a **Table of Contents** grouped by
  section (वेद/स्तोत्र/श्लोक + custom). Adding a mantra asks which section. The
  book re-paginates itself. TOC on the left page; tap a title → right page flips.
- **Audio sync:** **line-by-line** highlighting, timings from **auto-alignment**
  that runs in the browser (decode audio → measure loudness → cut on the pauses
  between lines; even-split fallback). Needs raw audio (upload/CC mp3) — YouTube
  embeds can't be synced.
- **Primary source:** vignanam.org (Vaidika Vignanam). Adapter chain is built so
  more sources (sanskritdocuments.org, stotranidhi.com) drop in with the same
  `fetchBySlug(slug, meta, script)` shape.
- **Multi-language (built):** first-run language picker (default Sanskrit),
  changeable anytime. One language setting drives BOTH the mantra script (fetch
  `/<script>/<slug>.html`) AND the UI language. Launch set: Sanskrit, Hindi,
  Tamil, Telugu, Kannada, Malayalam, English. en/sa/hi UI complete; ta/te/kn/ml
  are first-pass short labels + English fallback for long sentences — NEED NATIVE
  REVIEW.

## 4. What's built and working (DONE)

**Search resolver — FULL-SITE, no longer alias-limited (`lib/catalog.js`, NEW):**
- The curated alias catalog was a whitelist: anything not hand-added fell to a
  weak `slugify()` guess that 404'd (this bit us on "sandhyavandhanam", "upanishad",
  etc). Fixed by harvesting vignanam's **whole sitemap** so ANY stotra on the site
  is searchable.
- `lib/catalog.js` fetches `vignanam.org/sitemap.xml` (server-side, browser UA),
  parses every `<lang>/<slug>.html` into a deduped `{slug,name,nameNorm,tokens}`
  index, cached in-memory + on disk (lib/cache) with a weekly TTL, refreshed lazily
  in the background (so after the first build every request is instant). Two real
  bugs found & fixed + unit-tested: (a) the sitemap uses RELATIVE locs
  (`english/foo.html`, not absolute URLs) — `slugFromLoc` handles relative +
  absolute + leading slash, rejects bare landing pages & nested `media/` paths;
  (b) it dedupes one slug across scripts.
- Resolution chain in `lib/fetchMantra.js`: curated alias (rich deity/tradition
  metadata) → `catalog.resolveSlug()` fuzzy match on the full index (token
  coverage + despaced substring + a bounded Levenshtein for typos) → `slugify()`
  last resort. `/api/search` now returns curated (boosted) + full-index matches so
  every suggestion is a real, fetchable slug. Tests: `test/catalog.test.mjs` (8).

**Ad-free audio from the Internet Archive (`lib/audioSearch.js` + `/api/audio`, NEW):**
- Decision: **YouTube can't be forced ad-free** (ads are the video owner's + can't
  be stripped by an embedder; `youtube-nocookie` only cuts cookies). So recitations
  come from **archive.org** — plain public-domain/CC mp3s: ad-free by design, legal
  w/ attribution, and (unlike YouTube) analysable so **karaoke Auto-sync works**.
- `lib/audioSearch.js`: `advancedsearch` by mantra name (`mediatype:audio`) →
  score candidates (recitation vs lecture/discourse heuristics) → resolve the best
  item's mp3 via `/metadata`. THREE real bugs found & fixed + unit-tested
  (`test/audioSearch.test.mjs`, 7): (a) multi-track ALBUM items — pick the track
  whose FILENAME matches the mantra, not the shortest clip (Lalita Sahasranama was
  grabbing "Medha Sooktham"); (b) archive often returns docs with NO `title` (only
  `identifier`) — score off the de-camelCased identifier too (Vishnu Sahasranama
  returned nothing); (c) name threaded into "try another". `/api/audio?name=` (find)
  or `?item=` (resolve one). Attribution links the archive DETAILS page (not the
  raw download url).
- Reader audio UX (`app/page.js`): opening a mantra with no audio **auto-finds** a
  recitation once; it's **saved** to the book item (persists, "Saved" pill) so
  reopening plays directly — no re-search. Controls are ONE compact line: Saved ·
  **⤨ another voice** (shuffle; works on reopened items by re-searching on demand,
  auto-saves) · **✧ Auto-sync** (before syncing) / **∿ Follow on-off** +
  **↻ Re-sync** (after) · **Use my own audio** (reveals paste/upload). Manual box
  accepts a YouTube link OR an mp3 url (`parseYouTubeId`). **Follow** toggle gates
  the karaoke highlight+auto-page-turn (so it doesn't move when unwanted). **Fix
  highlight** line-nudge (±15) corrects a constant lead/lag (many recitations open
  with an "Om"/invocation not in the text → highlight one line ahead). All audio
  state (url, itemId, timings, lineShift, follow, attrib) persists per book item.
- Reader scroll fix: `.reader` is `overflow-x:hidden; overflow-y:auto` (setting
  only overflow-y makes overflow-x compute to `auto` → unwanted L/R scroll during
  the 3D page-flip; now top/bottom scroll only, sides still tap-to-flip).
- Bhava chant meditation also uses archive audio now: reuses the user's chosen
  track per mantra via a shared `localStorage` store `mantra-sangraha-audio-v1`
  (`loadAudioPref/saveAudioPref`), with the same **⤨ another voice** shuffle
  (auto-saved). Drone **mute fixed**: the swell LFO fed `master.gain`, so muting
  master left a ~10% residue — added a dedicated `mute` gain node after the filter
  that hard-ramps to EXACTLY 0. Mute choice **remembered** across opens
  (`mantra-sangraha-drone`).
- **Chant meditation redesign (Hari's call):** removed the forced "N of 10" lap
  counter + auto-advance + Pause/Again — meditation shouldn't prescribe a count.
  Centrepiece is now a **cinematic per-deity emblem** (`DeityScene` + `deityTheme`
  + `glyphSvg`): symbolic SVG glyph (trishul=Shiva, chakra=Vishnu/Surya,
  lotus=Devi/Lakshmi, ॐ=Ganesha/Hanuman/default), deity-tinted spinning god-rays,
  soft framing ring, breathing pulse. Symbols NOT photos (licence-safe, offline);
  swap in commissioned art per deity later without touching logic. The recitation
  shuffle now sits **inline in the player row** (native `<audio>` can't host custom
  buttons INSIDE its bar — docked flush beside it); archive attribution label
  removed from the meditation per Hari.
- **Audio robustness + i18n (latest):** when no recitation exists OR the mp3 fails
  to load (`<audio onError>`), the reader + meditation show a localized
  `audio_none` note ("No recitation available", translated sa/hi/ta/te/kn/ml) with
  a shuffle to try another — no more silent 0:00/0:00. `/api/audio` now returns
  **200 with `{ok:false}`** for "no audio" (404 was spamming the console; the
  console "GET not found" was the `<audio>` loading a dead archive url — onError
  now handles it gracefully). Book recitation label localized: shows
  `t('recitation') · Internet Archive` (drops the English recording title).
- **Offline recitations + outage handling (latest):** `lib/offline.js` is an
  IndexedDB blob store; the reader has a **"Save for offline"** button
  (`ti-cloud-download` → `ti-cloud-check`) that downloads the mp3 to the device and
  plays from the local copy (`audioSrc = offUrl || uploadUrl || audioMeta.url`), so
  a saved mantra plays with NO internet and survives archive.org outages. Toggle
  off to free space (`removeAudioBlob`). `find()` distinguishes `search_failed`
  (archive search errored — transient, NOT cached, NOT marked autoTried) from
  `no_audio` (genuinely none); the UI now shows a localized **`audio_unavailable`**
  ("recitations temporarily unavailable — try later", 7 langs) with a retry, vs
  `audio_none`. archive.org UA is now descriptive (good-citizen, avoids rate-limit
  lists). NOTE (2026-08-16): archive.org's SEARCH backend had an outage
  (`[BACKEND_ERROR] … Elasticsearch`) — NOT an IP block (metadata/file delivery
  still worked; same error seen from unrelated IPs); recovers on their side. Still
  TODO for full offline: SW caching of same-origin /api responses (text/meaning/
  search) so browsing works offline too; and "download for offline" in Bhava.

- **Web layout + PWA install (phase-2 start):** the desktop left icon-rail is now a
  **horizontal top header** (`.rail` flex-row, `.shell` column); mobile still uses
  the bottom `.tabbar`. **PWA installable**: `public/manifest.webmanifest` +
  `public/sw.js` (conservative network-first shell cache, leaves API/fonts/archive
  alone) + `app/icons/*` (ॐ on saffron gradient, rendered via Playwright — 192/512/
  maskable/apple-180 in `public/icons/`). `layout.js` wires manifest + apple metas.
  `InstallButton` (in the header + hero) captures `beforeinstallprompt` and fires the
  **native one-tap install** on Android/desktop Chromium (no Settings); iOS Safari
  has no such API → shows Share→"Add to Home Screen" instructions. Hidden when
  already installed / not yet installable. **NOTE:** install needs HTTPS + a real
  build (`next build && next start` or a deploy) — `beforeinstallprompt` won't fire
  on `localhost` dev for some setups; Vercel deploy (backlog) is the real test.

**Backend (server-side fetch):**
- `GET /api/fetch?mantra=<name>` → resolve (curated → full sitemap index → slugify)
  → fetch from vignanam.org (shuddha then plain, both www + non-www hosts) →
  parse to clean numbered verses → cache. Returns
  `{ ok, id, name, tradition, deity, script, source, sourceUrl, license, verses:[{n,text,section?,invocation?,colophon?}], lastNumber, ... }`.
- `GET /api/search?q=<text>` → curated + full-index suggestions.
- `GET /api/audio?name=<mantra>` or `?item=<id>` → ad-free archive.org recitation.
- **Parser** `lib/parse.js` is DOM-independent: strip markup → keep only
  Devanagari lines (drops all English nav/URLs/meta) → split on `॥ N ॥` markers.
  Verified: Soundarya Lahari → all 103 numbered verses (100 + 3 anubandha), no gaps.
- Aliases `lib/aliases.js` (~24 verified vignanam slugs + slugify fallback),
  cache `lib/cache.js` (in-memory + `./.cache` disk).
- **Important fix already applied:** the adapter sends a real browser User-Agent —
  vignanam returns 403 to unknown UAs. Diagnostics ("what the server tried") show
  per-URL status in the UI on failure.

**Frontend — CINEMATIC "DARSHAN" REDESIGN (current, approved by Hari):**
- Design language: bright/vibrant/cinematic, NOT the old indigo/maroon temple
  look. Glowing Om + god-rays hero, vibrant per-deity gradient cards, gold
  accents. Fonts: Cinzel (wordmark), Tiro Devanagari Sanskrit (Sanskrit), Poppins
  (UI) — Google Fonts @import in globals.css. Tabler icon webfont loaded in
  `app/layout.js` (jsdelivr CDN) for nav icons.
- Responsive nav: **left icon rail on web / bottom tab bar on mobile** — Home ·
  Book · Bhava · Playing (`.rail` / `.tabbar`, breakpoint 860px). "Playing"
  reopens the last-read reader.
- `app/page.js` structure: `Home` tab (hero + search + preview card w/ section
  picker + "Recently added" grid), `Book` tab (grouped grid of gradient cards),
  `Bhava` tab (`BhavaView`, curated feeling→mantra doorway), and the `Reader`
  overlay. Book model unchanged (`localStorage` `mantra-sangraha-book-v3`, grouped
  by section, auto-migrates old `-v2` flat array).
- **Reader = held, foldable book** (the piece Hari specifically wanted on mobile):
  two gilded-edged pages (`.pg.l` prev verse / `.pg.r` current verse) meeting at a
  `.spine`, `turnNext`/`turnPrev` page-flip keyframes, mandala watermark, gold
  `॥ n ॥` cartouche, deity glow (rrays + rhalo) behind. Left page shows the
  previous verse (or an Om "cover" at page 1). TOC is a slide-in **drawer**
  (`.toc-drawer`) via the list icon — grouped, numbered, tap-to-flip. Prev/next +
  arrow keys. Save-as-PDF via print.
- Karaoke unchanged in logic: audio bar (CC URL / upload / **Auto-sync words**),
  `<audio> timeupdate` → `currentLineIndex` → highlight `.vline.sung` + auto-flip
  to that verse. YouTube embeds play but can't sync.
- `lib/align.js` (unchanged) — browser alignment: `decodeToSamples` (Web Audio) →
  `frameEnergy` → `silenceRuns` → `boundariesFromSilence` (N-1 longest internal
  pauses) → per-line `{start,end}`; `evenSplit` fallback; `currentLineIndex`.
- `lib/feelings.js` — curated `FEELINGS[]`: each `{key,dev,en,dot,intent,
  picks:[{name,q,deity,note}]}`; `q` resolves through aliases so a tap fetches.
- **Localisation (new):** `lib/i18n.js` — `LANGS` (code, native name, `script`
  path), `t(lang,key)` with English fallback, `STRINGS` for 7 locales. `app/page.js`
  holds `lang` state (localStorage `mantra-sangraha-lang`), first-run `LangModal`
  (default `sa`), globe button to change, `t()` across UI, localized section +
  feeling labels. `doFetch` sends `&script=<langMeta.script>`. `lib/parse.js`
  generalised to any Indic script (`SCRIPTS` Unicode ranges + multi-script digit
  normalisation); `parseDocument(html, script)`. `sources/vignanam.js`
  `candidateUrls(slug, script)` → `/shuddha-<script>/` then `/<script>/`.
  `/api/fetch?mantra=&script=` (allow-listed). Cache key includes script.
- **Localized names + auto-heal (fix):** the adapter now extracts the stotra's
  own title from `og:title` (in the page's script) → `result.title`; the app
  displays `item.title || item.name`, so cards/reader/TOC show e.g. the Tamil
  name. Book items store the script they were fetched in; a `useEffect` on
  `[loaded, lang]` re-fetches any item whose script ≠ the current language's
  script (updating verses + localized title), so **existing Devanagari items
  convert to the newly-chosen script** (needs network once). Confirmed live:
  `/tamil/soundarya-lahari.html` → Tamil og:title + 103 verses parse correctly.
- **Later fixes:** (a) reader auto-fits each mantra to ONE uniform font size
  (`measureUniform` → `FitVerse baseSize`), so pages no longer vary in size and
  long verses aren't clipped (scroll only as a last resort). (b) Delete/trash
  button in the reader top bar + existing card × (`onRemove`). (c) Auto-heal now
  also re-fetches items missing a localized title (`|| !it.title`) and always sets
  `title` (localized or name) to avoid loops, so names show in the chosen script.
  (d) ta/te/kn/ml long strings now translated (still first-pass) + localized
  example chips. NATIVE REVIEW of Indic strings still wise.
- **Bhava = AI mood search + chant meditation (new, separate from Book).**
  `lib/mood.js` + `/api/mood?q=` match a free-text mood to REAL catalog mantras:
  OpenAI (`OPENAI_API_KEY`, model `gpt-4o-mini`, constrained to catalog slugs,
  validates slugs) with a keyword-matcher fallback when no key/offline. The model
  only CHOOSES; text is always fetched from the source. `BhavaView` is now a
  free-text box + AI button + example chips + result cards. Tapping a result opens
  `ChantMeditation` (overlay): fetches the mantra (`/api/fetch`) + meanings
  (`/api/meaning`), shows the verse, a breathing circle, a tap-to-count "N of 10"
  progress ring, breath cue, sourced meaning, recitation iframe when available
  (`DEFAULT_YT`), verse ‹/›, and a small "Save to Book" (`saveFromBhava` — the
  ONLY Book interaction from Bhava). Env: copy `.env.example` → `.env.local`.
  NOTE: the earlier static 6-mood chips + the reader "meaning toggle" were reverted
  at Hari's request; the meaning backend (`parseMeanings`, `/api/meaning`) is now
  used by ChantMeditation. Meditation UI strings: en/sa/hi/ta done, te/kn/ml fall
  back to en (native review pending).
- **Chant meditation details + fixes (2026-08-16):**
  - **Auto-count**: advances one chant per ~7s (matches the breathing animation),
    with Pause/Resume; tapping the ring pauses/resumes; ॐ + "Again" at 10.
  - **Background drone**: `createDrone()` synthesizes a soft tanpura (Sa–Pa–Sa,
    detuned triangle voices, low-pass, slow swell) via Web Audio — always
    available, offline, no files. Speaker icon mutes. IMPORTANT: browsers need a
    user gesture — the drone resumes on the first pointer-down in the view. (Tuned
    blind since the assistant can't hear audio; if wrong, a real CC0 loop is the
    reliable alt.) A real recitation VOICE still only plays when one exists
    (`DEFAULT_YT`); no universal royalty-free recitation source, TTS avoided.
  - **AI variety**: prompt now maps deity→mood and demands varied picks;
    temperature 0.6 (catalog is Shiva-heavy, so anger/calm skew Shiva — expected).
  - **Localized card names**: for non-en UIs, BhavaView lazily fetches each
    match's localized title (also pre-warms the chant fetch); en keeps English.
  - **Meanings**: ChantMeditation fetches the meaning page as `devanagari` always
    (English text, most reliable `भावार्थ` parse). Some mantras have no meaning
    page → simply no meaning shown.
  - **Save toast**: the bookmark icon (next to speaker) = Save to Book; now shows
    a "Saved ✓" toast (`saved_toast`) and fills the icon.
- **Reader interaction (new):** tap the left/right side of the book (`.tapzone`) or
  swipe to turn — replaced the big arrow buttons (page count + hint text remain,
  keyboard arrows still work). Two reading modes via a toolbar toggle: `book`
  (two-page spread) and `large` (single big page, easier for older readers);
  persisted in `mantra-sangraha-readmode`. Optional hands-free `auto` page-turn
  (7s) toggle. The uniform font auto-scales up in `large` mode (bigger box →
  bigger measured size). The lang picker now previews in the language you tap
  (`LangModal` uses `translate(sel, …)`).
- **Design mockups** were approved via the visual preview tool before building
  (cinematic home, book grid, foldable reader on mobile, Bhava). The old
  temple-manuscript CSS/JSX was fully replaced.

**Verification (all green):**
- `npm test` → 25/25 pass: parser (Soundarya Lahari 103 verses, no chrome leak) +
  alignment + **catalog** (sitemap parse, relative locs, dedupe, fuzzy/typo,
  upanishad) + **audioSearch** (multi-track album pick, title-less identifier
  scoring, deCamel, downloadUrl, longest-fallback).
- `npm run build` → clean. Next pinned to patched **14.2.35** (14.2.5 had a
  security advisory).
- Honesty: live network paths (sitemap harvest, archive search, real recitation
  playback + auto-sync) are validated via sanctioned lookups + unit tests on
  fixtures/real payloads; the assistant env can't run the live app, so the
  end-to-end is confirmed by running `npm run dev`.

## 5. File inventory (`D:\mantra_sangraha`)

```
package.json            next 14.2.35, scripts: dev / build / start / test
next.config.mjs  jsconfig.json  .gitignore  README.md  CONTINUE.md (this file)
app/
  layout.js             metadata + Tabler icon webfont (jsdelivr)
  globals.css           cinematic "darshan" theme + nav + foldable book + audio UI
  page.js               main UI (nav tabs, hero, book grid, Bhava, foldable reader,
                        reader audio controls, ChantMeditation, drone w/ true mute)
  api/fetch/route.js    GET /api/fetch?mantra=
  api/search/route.js   GET /api/search?q=  (curated + full sitemap index)
  api/audio/route.js    GET /api/audio?name= | ?item=  (ad-free archive.org mp3)
  api/mood/route.js     GET /api/mood?q=  (Bhava AI mood match)
  api/meaning/route.js  GET /api/meaning?mantra=  (sourced verse meanings)
lib/
  fetchMantra.js        orchestrator: curated -> full index -> slugify; adapters
  catalog.js            NEW: vignanam sitemap harvest -> full slug index + fuzzy resolve
  audioSearch.js        NEW: archive.org search -> best mp3 track (ad-free recitations)
  aliases.js            curated catalog + normalise/slugify/resolve/suggest
  feelings.js           curated feeling -> mantra map (Bhava doorway)
  mood.js               free-text mood -> catalog mantra (OpenAI + keyword fallback)
  i18n.js               UI localisation (7 locales) + language -> script mapping
  parse.js              markup strip + verse splitting (any Indic script)
  align.js              browser line-alignment (pure math + Web Audio glue)
  cache.js              in-memory + on-disk (./.cache); also caches the sitemap index
  sources/vignanam.js   Vaidika Vignanam adapter (browser UA, www + non-www)
  sources/sanskritdocuments.js  Devanagari fallback adapter (curated SLUG_MAP)
test/
  parse.test.mjs        Soundarya Lahari -> 103 verses; no chrome leak
  align.test.mjs        silence segmentation + even split + currentLineIndex
  catalog.test.mjs      NEW: sitemap parse/dedupe/fuzzy/typo/upanishad
  audioSearch.test.mjs  NEW: album track pick, title-less scoring, deCamel, fallback
fixtures/
  soundarya-lahari.devanagari.body.txt   parser fixture (real page body)
  soundarya-lahari.devanagari.sample.txt (older raw sample; harmless)
```

Run: `npm install` → `npm run dev` (http://localhost:3000) → type "Soundarya
Lahari". Test: `npm test`. Git remote: `HVtechno/mantra_sangraha` (nothing pushed
by the assistant; changes are uncommitted for review). NOTE: audio + sitemap index
are cached per mantra/site — after a fix, reload / clear the relevant cache entry.

## 6. What's next (backlog, roughly in order)

> **DONE this session:** full-site search resolver (section 4), ad-free archive.org
> audio + reader audio UX + Bhava audio + drone mute fix (section 4). Earlier: full
> "darshan" redesign, foldable reader, Bhava AI mood + meditation.
>
> **Remaining backlog:**

1. **Tap-along manual timing fine-tune** (the real fix for karaoke drift): a mode
   where you tap at each line while the audio plays to set/replace timings when a
   reciter doesn't pause cleanly. The ±15 line-nudge + Follow toggle we shipped
   only correct a CONSTANT offset; progressive drift needs tap-along. Store per-item
   like auto timings (`item.audio.timings` + `method:'tap'`).
2. **Aartis / bhajans not on vignanam** (e.g. "Om Jai Amba Gauri", "Om Jai
   Jagdish Hare") — vignanam is stotra/veda-focused and lacks popular aartis.
   **SOURCE DECISION PENDING** (discussed with Hari, not yet chosen). Options:
   (a) sanskritdocuments.org has some aartis (Devanagari) — extend the existing
   `sources/sanskritdocuments.js` SLUG_MAP; (b) a small curated public-domain
   aarti pack shipped in-repo (aartis are traditional/PD, lyrics stable) as a new
   `sources/aartis.js` local adapter — most reliable, no scraping; (c) another
   open lyrics source. Aartis are refrain-based (not `॥ N ॥` numbered) so the
   parser may need an aarti mode. LEAN: (b) a curated local PD pack for the top
   ~15 aartis, since coverage + accuracy matter and the set is small/stable.
3. **DONE — User-added mantra → feeling in Bhava.** "My mantras" section in
   `BhavaView`: "Add your own" form (feeling text + mantra name resolved via
   /api/search) persists to `mantra-sangraha-myfeelings-v1`; cards play (open
   ChantMeditation) + remove. For true OFFLINE playback the user still Saves to
   Book from the meditation (custom picks store only `{feeling,q,name,deity}`, not
   verses); full offline is the PWA item.
4. **Native-speaker review of ta/te/kn/ml UI strings** in `lib/i18n.js` (first-pass;
   long sentences fall back to English). Also (a) native-script NAME search (typing
   a mantra name in Tamil/Telugu doesn't resolve — index is romanised); (b) a
   "re-fetch existing book items in current language" action.
5. **PWA** (service worker + manifest) + IndexedDB to persist UPLOADED audio across
   reloads (archive/url audio + timings already persist; uploads are session-only).
6. TOC editing (reorder/rename sections, drag between sections); transliteration +
   per-mantra "report a correction" link; richer drag-to-turn; deploy to Vercel
   (set `OPENAI_API_KEY` env for Bhava AI) for cross-device use.

## 7. Known limitations / honesty notes (carry these forward)

- The assistant environment **can't run the live network fetch or the browser
  UI/audio** — the fetch path and karaoke were validated end-to-end only by (a)
  confirming the source returns full text via a sanctioned fetch, (b) the parser
  producing 103 correct verses, and (c) alignment math against synthetic signals.
  Real recitations may need a second Auto-sync tap (hence backlog #1).
- **Auto-sync needs raw audio** (upload or CORS-enabled CC mp3). YouTube embeds
  play but can't highlight (no PCM samples).
- Uploaded audio is **session-only** (object URL); its computed timings persist,
  but the file must be re-added after reload until IndexedDB (backlog #4). Archive
  recitations + pasted URLs/YouTube DO persist (per book item, and per mantra in
  `mantra-sangraha-audio-v1` for Bhava).
- **Audio = archive.org, ad-free by design.** YouTube embeds CANNOT be forced
  ad-free (owner-controlled) — that's why recitations default to archive.org mp3s.
  Coverage isn't universal (obscure mantras may find nothing → paste/upload).
  Relevance is heuristic (recitation vs lecture) + picks the name-matching track in
  multi-track albums; not perfect → "another voice" shuffle + manual override exist.
  CORS on archive files usually allows Auto-sync; if a file blocks it, playback
  still works, just no highlight on that one.
- **Karaoke sync is heuristic** (silence detection). The Follow on/off + ±15 line-
  nudge correct a CONSTANT lead/lag (recitations often open with an "Om"/invocation
  not in the text → highlight one line ahead). PROGRESSIVE drift is NOT fully fixable
  by a constant nudge — tap-along (backlog #1) is the real fix.
- **Full-site resolver:** `lib/catalog.js` makes ~any vignanam stotra searchable,
  so the old ~44-alias whitelist is no longer the ceiling. Curated aliases remain
  for rich metadata + colloquial first-lines. Alias catalog still lists ~44 slugs
  (added Rudram Namakam/Chamakam/Laghunyasam,
  Purusha/Narayana/Medha/Manyu/Ganapati Suktam, Mantra Pushpam, Gayatri, and Shiva
  stotras: Lingashtakam, Shiva Tandava, Mahimna, Bilvashtakam, Rudrashtakam,
  Kalabhairava Ashtakam, Mahamrityunjaya, Shadakshari, Jyotirlinga, Shiva
  Sahasranama). Unknown names still fall back to a slugify guess (may 404).
- **Second source (added): `lib/sources/sanskritdocuments.js`.** `SOURCES` in
  fetchMantra.js is now `[vignanam, sanskritdocuments]` — vignanam (all scripts)
  first, then sanskritdocuments as a fallback. Honest limits: its per-text HTML is
  DEVANAGARI ONLY (other scripts are PDFs we don't parse), so the adapter declines
  non-devanagari requests; and filenames are idiosyncratic (`doc_shiva/lingashh`,
  not `lingashtakam`), so it uses a curated `SLUG_MAP` (verified: lingashtakam,
  soundarya-lahari, sri-rudram-namakam/chamakam → doc_shiva/rudram). Extend the map
  to grow coverage. Because vignanam already has these, this fallback rarely fires
  — it's genuine redundancy for when vignanam is down or lacks a Devanagari text.
  stotranidhi.com was rejected earlier (returned empty to the fetcher — JS/Cloudflare).
- Parser tweak: the leading-invocation split now fires only when the first chunk
  is EXACTLY two danda-units, so Vedic prose (Rudram anuvaka 1) stays whole.
  Locked by a unit test.
- **Multi-language:** Telugu was confirmed live earlier (same `॥ n ॥` markers);
  Tamil/Kannada/Malayalam share the identical URL + markup pattern and the parser
  is unit-tested on synthetic Tamil, but the assistant did not live-fetch each
  script. ta/te/kn/ml UI strings are first-pass (English fallback for long
  sentences) — NEED NATIVE REVIEW. Regional-script name search not yet supported.

## 8. Two things to always get right

1. Always show **source + license** on every mantra (trust + transparency).
2. **Text accuracy is sacred** — prefer well-maintained sources, keep a
   "report a correction" path. A misspelled mantra is worse than none.

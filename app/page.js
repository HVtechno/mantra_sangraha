'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { alignLines, currentLineIndex } from '@/lib/align';
import { LANGS, DEFAULT_LANG, langMeta, t as translate } from '@/lib/i18n';
import { saveAudioBlob, getAudioBlob, removeAudioBlob } from '@/lib/offline';
import { resolve as resolveMantra, CATALOG } from '@/lib/aliases';
import { mantraName } from '@/lib/mantraNames';

const STORAGE_KEY = 'mantra-sangraha-book-v3';
const OLD_KEY = 'mantra-sangraha-book-v2';
const LANG_KEY = 'mantra-sangraha-lang';
const AUDIO_KEY = 'mantra-sangraha-audio-v1'; // per-mantra chosen recitation (used by Bhava)

function loadAudioPref(slug) { try { return (JSON.parse(localStorage.getItem(AUDIO_KEY) || '{}'))[slug] || null; } catch { return null; } }
function saveAudioPref(slug, obj) { try { const m = JSON.parse(localStorage.getItem(AUDIO_KEY) || '{}'); m[slug] = obj; localStorage.setItem(AUDIO_KEY, JSON.stringify(m)); } catch {} }

const DEFAULT_SECTIONS = [
  { id: 'veda', dev: 'वेद', en: 'Veda' },
  { id: 'stotra', dev: 'स्तोत्र', en: 'Stotra' },
  { id: 'sloka', dev: 'श्लोक', en: 'Sloka' },
];
const EXAMPLES = [
  { q: 'Soundarya Lahari', l: { sa: 'सौन्दर्य लहरी', hi: 'सौन्दर्य लहरी', ta: 'சௌந்தர்ய லஹரீ', te: 'సౌందర్య లహరి', kn: 'ಸೌಂದರ್ಯ ಲಹರಿ', ml: 'സൗന്ദര്യ ലഹരി' } },
  { q: 'Bhaja Govindam', l: { sa: 'भज गोविन्दम्', hi: 'भज गोविन्दम्', ta: 'பஜ கோவிந்தம்', te: 'భజ గోవిందం', kn: 'ಭಜ ಗೋವಿಂದಂ', ml: 'ഭജ ഗോവിന്ദം' } },
  { q: 'Nirvana Shatkam', l: { sa: 'निर्वाण षट्कम्', hi: 'निर्वाण षट्कम्', ta: 'நிர்வாண ஷட்கம்', te: 'నిర్వాణ షట్కం', kn: 'ನಿರ್ವಾಣ ಷಟ್ಕಂ', ml: 'നിർവാണ ഷട്കം' } },
  { q: 'Aigiri Nandini', l: { sa: 'ऐगिरि नन्दिनी', hi: 'ऐगिरि नन्दिनी', ta: 'ஐகிரி நந்தினி', te: 'ఐగిరి నందిని', kn: 'ಐಗಿರಿ ನಂದಿನಿ', ml: 'ഐഗിരി നന്ദിനി' } },
  { q: 'Kanakadhara Stotram', l: { sa: 'कनकधारा स्तोत्रम्', hi: 'कनकधारा स्तोत्रम्', ta: 'கனகதாரா ஸ்தோத்திரம்', te: 'కనకధారా స్తోత్రం', kn: 'ಕನಕಧಾರಾ ಸ್ತೋತ್ರಂ', ml: 'കനകധാരാ സ്തോത്രം' } },
  { q: 'Sivapuranam', l: { sa: 'शिव पुराणम्', hi: 'शिव पुराणम्', ta: 'சிவ புராணம்', te: 'శివ పురాణం', kn: 'ಶಿವ ಪುರಾಣಂ', ml: 'ശിവ പുരാണം' } },
  { q: 'Hanuman Chalisa', l: { sa: 'हनुमान चालीसा', hi: 'हनुमान चालीसा', ta: 'ஹனுமான் சாலீசா', te: 'హనుమాన్ చాలీసా', kn: 'ಹನುಮಾನ್ ಚಾಲೀಸಾ', ml: 'ഹനുമാൻ ചാലീസ' } },
  { q: 'Venkateswara Suprabhatam', l: { sa: 'वेङ्कटेश्वर सुप्रभातम्', hi: 'वेंकटेश्वर सुप्रभातम्', ta: 'வெங்கடேஸ்வர ஸுப்ரபாதம்', te: 'వేంకటేశ్వర సుప్రభాతం', kn: 'ವೇಂಕಟೇಶ್ವರ ಸುಪ್ರಭಾತಂ', ml: 'വേങ്കടേശ്വര സുപ്രഭാതം' } },
  { q: 'Nava Graha Stotram', l: { sa: 'नवग्रह स्तोत्रम्', hi: 'नवग्रह स्तोत्रम्', ta: 'நவகிரக ஸ்தோத்திரம்', te: 'నవగ్రహ స్తోత్రం', kn: 'ನವಗ್ರಹ ಸ್ತೋತ್ರಂ', ml: 'നവഗ്രഹ സ്തോത്രം' } },
];
// Audio is never hardcoded — every recitation is discovered on demand from the
// ad-free archive.org lookup (/api/audio), or pasted/uploaded by the user.

// --- Suggest / feedback (in-app notification) ------------------------------
const APP_VERSION = '2';                 // bump alongside sw.js CACHE on deploy
const REQ_KEY = 'ms-pending-requests';   // mantra requests awaiting the badge
const CLIENT_KEY = 'ms-client-id';       // anonymous per-device id (not a login)
function clientId() {
  try { let id = localStorage.getItem(CLIENT_KEY); if (!id) { id = Math.random().toString(36).slice(2) + Date.now().toString(36); localStorage.setItem(CLIENT_KEY, id); } return id; } catch { return ''; }
}
function loadPending() { try { return JSON.parse(localStorage.getItem(REQ_KEY) || '[]'); } catch { return []; } }
function savePending(list) { try { localStorage.setItem(REQ_KEY, JSON.stringify(list)); } catch {} }

// --- Browse by deity + voice ------------------------------------------------
// Chips render in this order; only groups that have catalog members show.
const DEITY_GROUPS = [
  { key: 'ganesha', c: '#ff9a5a', l: { en: 'Ganesha', sa: 'गणेश', hi: 'गणेश', ta: 'விநாயகர்', te: 'గణేశ', kn: 'ಗಣೇಶ', ml: 'ഗണേശൻ' } },
  { key: 'shiva', c: '#7db2ff', l: { en: 'Shiva', sa: 'शिव', hi: 'शिव', ta: 'சிவன்', te: 'శివ', kn: 'ಶಿವ', ml: 'ശിവൻ' } },
  { key: 'vishnu', c: '#ffd24a', l: { en: 'Vishnu', sa: 'विष्णु', hi: 'विष्णु', ta: 'விஷ்ணு', te: 'విష్ణు', kn: 'ವಿಷ್ಣು', ml: 'വിഷ്ണു' } },
  { key: 'devi', c: '#ff6fae', l: { en: 'Devi', sa: 'देवी', hi: 'देवी', ta: 'தேவி', te: 'దేవి', kn: 'ದೇವಿ', ml: 'ദേവി' } },
  { key: 'hanuman', c: '#ff7a4a', l: { en: 'Hanuman', sa: 'हनुमान', hi: 'हनुमान', ta: 'அனுமன்', te: 'హనుమాన్', kn: 'ಹನುಮಾನ್', ml: 'ഹനുമാൻ' } },
  { key: 'surya', c: '#ffd36b', l: { en: 'Surya', sa: 'सूर्य', hi: 'सूर्य', ta: 'சூரியன்', te: 'సూర్య', kn: 'ಸೂರ್ಯ', ml: 'സൂര്യൻ' } },
  { key: 'muruga', c: '#ff6f8b', l: { en: 'Subramanya', sa: 'सुब्रह्मण्य', hi: 'सुब्रह्मण्य', ta: 'முருகன்', te: 'సుబ్రహ్మణ్య', kn: 'ಸುಬ್ರಹ್ಮಣ್ಯ', ml: 'സുബ്രഹ്മണ്യൻ' } },
  { key: 'ayyappa', c: '#7fd0ff', l: { en: 'Ayyappa', sa: 'अय्यप्पा', hi: 'अय्यप्पा', ta: 'ஐயப்பன்', te: 'అయ్యప్ప', kn: 'ಅಯ್ಯಪ್ಪ', ml: 'അയ്യപ്പൻ' } },
  { key: 'guru', c: '#c9a0ff', l: { en: 'Guru / Datta', sa: 'गुरु / दत्त', hi: 'गुरु / दत्त', ta: 'குரு / தத்தர்', te: 'గురు / దత్త', kn: 'ಗುರು / ದತ್ತ', ml: 'ഗുരു / ദത്ത' } },
  { key: 'veda', c: '#8ee6c9', l: { en: 'Veda', sa: 'वेद', hi: 'वेद', ta: 'வேதம்', te: 'వేదం', kn: 'ವೇದ', ml: 'വേദം' } },
];
function deityGroup(deity) {
  const d = String(deity || '').toLowerCase();
  if (/hanuman|anjaneya/.test(d)) return 'hanuman';
  if (/ganesha|ganapati|vinayaka/.test(d)) return 'ganesha';
  if (/subrahmanya|subramanya|kartikeya|muruga|skanda/.test(d)) return 'muruga';
  if (/ayyappa|hariharatmaja|sastha|manikanta/.test(d)) return 'ayyappa';
  if (/surya|aditya|navagraha/.test(d)) return 'surya';
  if (/dattatreya|guru|sai baba|shirdi/.test(d)) return 'guru';
  if (/shiva|bhairava|ardhanari|rudra|nataraja|maheswara|atman/.test(d)) return 'shiva';
  if (/lakshmi|durga|saraswati|devi|lalita|parvati|medha|annapurna/.test(d)) return 'devi';
  if (/vishnu|venkateswara|krishna|narasimha|rama|govinda|purusha|narayana|jagannatha|balaji/.test(d)) return 'vishnu';
  return 'veda';
}
// Localised deity label for a catalog `deity` string, via its group (falls back to the raw deity).
function deityLabel(deity, lang) {
  if (!deity) return '';
  const g = DEITY_GROUPS.find((x) => x.key === deityGroup(deity));
  return (g && g.l && (g.l[lang] || g.l.en)) || deity;
}
// UI language -> speech-recognition locale (names are best heard as Indian English/Hindi).
const VOICE_LANG = { sa: 'hi-IN', hi: 'hi-IN', ta: 'ta-IN', te: 'te-IN', kn: 'kn-IN', ml: 'ml-IN', en: 'en-IN' };
const DEFAULT_YT = {};

const GRADS = [
  'linear-gradient(125deg,#e0457a,#7a1f6a)', 'linear-gradient(125deg,#2aa38a,#125e7a)',
  'linear-gradient(125deg,#7a4ad0,#3a2074)', 'linear-gradient(125deg,#d0982a,#8a5410)',
  'linear-gradient(125deg,#3a6ad0,#1e2f74)', 'linear-gradient(125deg,#f0642a,#a11e6a)',
];
function hash(s) { let h = 0; for (let i = 0; i < String(s).length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return Math.abs(h); }
const gradientFor = (id) => GRADS[hash(id) % GRADS.length];

function emptyBook() { return { version: 3, sections: DEFAULT_SECTIONS.slice(), items: [] }; }
function migrate(oldArr) { const b = emptyBook(); b.items = (oldArr || []).map((m) => ({ ...m, sectionId: 'stotra' })); return b; }
function guessSection(tr) { return tr && /veda|aranyaka|upanishad|rig|yajur|sama|atharva|suktam/i.test(tr) ? 'veda' : 'stotra'; }
function flatLinesOf(item) {
  const lines = [];
  (item.verses || []).forEach((v, vi) => String(v.text || '').split('\n').forEach((ln) => { const x = ln.trim(); if (x) lines.push({ verseIdx: vi, text: x }); }));
  return lines;
}
const SEC_KEY = { veda: 'sec_veda', stotra: 'sec_stotra', sloka: 'sec_sloka' };

// Extract an 11-char YouTube video id from any common URL form (watch, youtu.be,
// embed, shorts) or a bare id. Returns null if it isn't a YouTube link.
function parseYouTubeId(s) {
  const str = String(s || '').trim();
  const m = str.match(/(?:youtu\.be\/|[?&]v=|\/embed\/|\/shorts\/)([A-Za-z0-9_-]{11})/);
  if (m) return m[1];
  if (/^[A-Za-z0-9_-]{11}$/.test(str)) return str;
  return null;
}

function Rays({ color = '#ffe6a0', className = 'rays' }) {
  return (
    <svg className={className} viewBox="0 0 100 100" aria-hidden="true"><g fill={color}>
      {Array.from({ length: 24 }).map((_, i) => <polygon key={i} points="49.5,0 50.5,0 50,48" transform={`rotate(${i * 15} 50 50)`} />)}
    </g></svg>
  );
}
function Halo({ className = 'halo', om = '#fff' }) {
  return (
    <svg className={className} viewBox="0 0 100 100" aria-hidden="true">
      <circle cx="50" cy="50" r="30" fill="rgba(255,255,255,0.15)" /><circle cx="50" cy="50" r="30" fill="none" stroke="#fff2c0" strokeWidth="1.4" />
      <text x="50" y="66" fontSize="40" textAnchor="middle" fill={om} style={{ fontFamily: 'var(--deva)' }}>ॐ</text>
    </svg>
  );
}

export default function Home() {
  const [lang, setLang] = useState(DEFAULT_LANG);
  const [langModal, setLangModal] = useState(false);
  const [tab, setTab] = useState('home');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [preview, setPreview] = useState(null);
  const [previewSection, setPreviewSection] = useState('stotra');
  const [newSection, setNewSection] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [book, setBook] = useState(emptyBook());
  const [reader, setReader] = useState(null);
  const [lastReadId, setLastReadId] = useState(null);
  const [chant, setChant] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [pending, setPending] = useState([]);     // mantra requests awaiting a match
  const [readyReq, setReadyReq] = useState(null);  // { text, name } once one is available
  const [deityFilter, setDeityFilter] = useState(null); // null = Popular, else a deity group key
  const [listening, setListening] = useState(false);    // voice search active
  const [voiceOK, setVoiceOK] = useState(false);        // browser supports speech recognition
  const recRef = useRef(null);

  // Group the catalog by deity for the browse chips (deduped by slug).
  const deityMembers = useMemo(() => {
    const m = {}; const seen = new Set();
    for (const rec of CATALOG) { if (seen.has(rec.slug)) continue; seen.add(rec.slug); const g = deityGroup(rec.deity); (m[g] = m[g] || []).push(rec); }
    return m;
  }, []);

  // Popular = a fresh random handful of the whole catalog, reshuffled on every
  // app open. Done in an effect (client-only) so it never causes a hydration flash.
  const [popularSample, setPopularSample] = useState([]);
  useEffect(() => {
    const pool = [];
    const seen = new Set();
    for (const r of CATALOG) { if (!seen.has(r.slug)) { seen.add(r.slug); pool.push(r); } }
    for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
    setPopularSample(pool.slice(0, 8));
  }, []);

  // ---- Continuous "Play all" player (rides on the existing archive streaming) --
  const [queue, setQueue] = useState([]);      // [{ slug, name, deity }]
  const [qi, setQi] = useState(-1);            // current index (-1 = idle)
  const [qUrl, setQUrl] = useState('');        // resolved mp3 url of current track
  const [qPlaying, setQPlaying] = useState(false);
  const [qOpen, setQOpen] = useState(false);   // expanded player overlay
  const [qLabel, setQLabel] = useState('');
  const [qProg, setQProg] = useState(0);       // 0..100
  const [qLoading, setQLoading] = useState(false); // resolving/buffering a track
  const playerAudio = useRef(null);

  const playAll = (list, label) => {
    const items = (list || []).map((r) => ({ slug: r.slug, name: r.name, deity: r.deity }));
    if (!items.length) return;
    setQueue(items); setQLabel(label || ''); setQOpen(false); setQi(0);
  };
  const advance = (dir, auto) => setQi((i) => {
    if (i < 0) return i;
    let n = i + dir;
    if (n < 0) n = auto ? -1 : (queue.length - 1);
    else if (n >= queue.length) n = auto ? -1 : 0;
    return n;
  });
  const togglePlay = () => { const a = playerAudio.current; if (!a) return; if (a.paused) { a.play().then(() => setQPlaying(true)).catch(() => {}); } else { a.pause(); setQPlaying(false); } };

  // Resolve + play the current track; skip forward when a track has no audio.
  useEffect(() => {
    if (qi < 0 || !queue[qi]) { setQUrl(''); const a = playerAudio.current; if (a) { try { a.pause(); } catch {} } setQPlaying(false); setQLoading(false); return; }
    let cancelled = false; setQUrl(''); setQProg(0); setQLoading(true);
    (async () => {
      const it = queue[qi];
      try {
        const r = await fetch(`/api/audio?slug=${encodeURIComponent(it.slug)}&name=${encodeURIComponent(it.name || '')}`);
        const j = await r.json();
        if (cancelled) return;
        if (j.ok && j.url) setQUrl(j.url); else advance(1, true);
      } catch { if (!cancelled) advance(1, true); }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qi, queue]);
  // Autoplay when the resolved url changes.
  useEffect(() => { const a = playerAudio.current; if (a && qUrl) a.play().then(() => setQPlaying(true)).catch(() => {}); }, [qUrl]);

  const t = useCallback((k) => translate(lang, k), [lang]);
  const script = langMeta(lang).script;

  // Register the service worker (enables PWA install + offline shell) and keep it
  // fresh: check for a new version whenever the app regains focus, and when a new
  // worker takes control, reload ONCE so the new build lands without the user
  // having to hard-refresh several times. The `hadController` guard prevents a
  // reload on the very first install (when there was no controller yet).
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
    const hadController = !!navigator.serviceWorker.controller;
    let refreshing = false;
    const onCtrl = () => { if (!hadController || refreshing) return; refreshing = true; window.location.reload(); };
    navigator.serviceWorker.addEventListener('controllerchange', onCtrl);
    let reg = null;
    navigator.serviceWorker.register('/sw.js').then((r) => { reg = r; if (r.update) r.update(); }).catch(() => {});
    const onVis = () => { if (document.visibilityState === 'visible' && reg && reg.update) reg.update(); };
    document.addEventListener('visibilitychange', onVis);
    return () => { navigator.serviceWorker.removeEventListener('controllerchange', onCtrl); document.removeEventListener('visibilitychange', onVis); };
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setBook(JSON.parse(raw));
      else { const old = localStorage.getItem(OLD_KEY); if (old) setBook(migrate(JSON.parse(old))); }
      const savedLang = localStorage.getItem(LANG_KEY);
      if (savedLang && LANGS.some((l) => l.code === savedLang)) setLang(savedLang);
      else setLangModal(true); // first run -> ask
    } catch {}
    setLoaded(true);
  }, []);
  useEffect(() => {
    if (!loaded) return;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...book, items: book.items.map((m) => ({ ...m, audio: { ...(m.audio || {}), upload: undefined } })) })); } catch {}
  }, [book, loaded]);

  const chooseLang = (code) => { setLang(code); try { localStorage.setItem(LANG_KEY, code); } catch {} setLangModal(false); };

  // In-app notification: when a mantra the user asked for now exists in the
  // catalog (because we added it), surface a badge on next open. Matching is
  // local — no server, no accounts — using the same resolver as search.
  useEffect(() => {
    const list = loadPending();
    setPending(list);
    for (const p of list) { const rec = resolveMantra(p.text); if (rec) { setReadyReq({ text: p.text, name: rec.name }); break; } }
  }, [loaded]);

  const onFeedbackSubmitted = (kind, text) => {
    if (kind !== 'mantra') return;
    if (resolveMantra(text)) return; // already exists — nothing to wait for
    const list = [...loadPending().filter((p) => p.text.toLowerCase() !== text.toLowerCase()), { text, ts: Date.now() }];
    savePending(list); setPending(list);
  };
  const dismissReady = () => {
    if (!readyReq) return;
    const list = loadPending().filter((p) => p.text.toLowerCase() !== readyReq.text.toLowerCase());
    savePending(list); setPending(list); setReadyReq(null);
  };
  const openReady = () => { if (!readyReq) return; const name = readyReq.name || readyReq.text; setTab('home'); setQuery(name); doFetch(name); dismissReady(); };

  // Auto-heal: when the chosen language's script differs from what a book item
  // was stored in, re-fetch that item in the current script (so existing mantras
  // convert to e.g. Tamil, and pick up their localized title).
  useEffect(() => {
    if (!loaded) return;
    const scr = langMeta(lang).script;
    const norm = (s) => (s || 'devanagari').replace('shuddha-', '');
    // Re-fetch if the script doesn't match OR we never captured a localized title.
    const targets = book.items.filter((it) => norm(it.script) !== scr || !it.title);
    if (!targets.length) return;
    let cancelled = false;
    (async () => {
      for (const it of targets) {
        if (cancelled) break;
        try {
          const r = await fetch(`/api/fetch?mantra=${encodeURIComponent(it.id)}&script=${encodeURIComponent(scr)}`);
          const j = await r.json();
          // Always set a title (localized when available, else the name) so this
          // item won't be re-fetched forever.
          if (j.ok && !cancelled) patchItem(it.id, { verses: j.verses, verseCount: j.verseCount, lastNumber: j.lastNumber, script: j.script, title: j.title || it.name });
        } catch {}
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, lang]);

  useEffect(() => {
    const q = query.trim(); if (!q) { setSuggestions([]); return; }
    const timer = setTimeout(async () => {
      try { const r = await fetch(`/api/search?q=${encodeURIComponent(q)}`); const j = await r.json(); setSuggestions(j.results || []); } catch {}
    }, 180);
    return () => clearTimeout(timer);
  }, [query]);

  const doFetch = useCallback(async (term) => {
    const q = (term ?? query).trim(); if (!q) return;
    setTab('home'); setLoading(true); setError(null); setPreview(null);
    try {
      const r = await fetch(`/api/fetch?mantra=${encodeURIComponent(q)}&script=${encodeURIComponent(script)}`);
      const j = await r.json();
      if (j.ok) { setPreview(j); setPreviewSection(guessSection(j.tradition)); } else setError(j);
    } catch { setError({ message: 'Network error — is the dev server running?' }); }
    finally { setLoading(false); }
  }, [query, script]);

  // Voice search: fill the box from speech, then fetch. Web Speech API (works in
  // Chrome / the Android app). Falls back silently where unsupported.
  useEffect(() => {
    if (typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition)) setVoiceOK(true);
  }, []);
  const startVoice = () => {
    const SR = typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition);
    if (!SR) return;
    if (listening) { try { recRef.current && recRef.current.stop(); } catch {} return; }
    const rec = new SR();
    rec.lang = VOICE_LANG[lang] || 'en-IN';
    rec.interimResults = true; rec.maxAlternatives = 1; rec.continuous = false;
    let finalText = '';
    rec.onresult = (e) => {
      let txt = '';
      for (let i = e.resultIndex; i < e.results.length; i++) txt += e.results[i][0].transcript;
      txt = txt.trim(); setQuery(txt);
      if (e.results[e.results.length - 1].isFinal) finalText = txt;
    };
    rec.onerror = () => setListening(false);
    rec.onend = () => { setListening(false); const q = finalText.trim(); if (q) doFetch(q); };
    recRef.current = rec; setListening(true);
    try { rec.start(); } catch { setListening(false); }
  };

  const inBook = (id) => book.items.some((b) => b.id === id);
  const addToBook = (item) => {
    if (inBook(item.id)) { openReader(item.id); return; }
    let sections = book.sections.length ? book.sections : DEFAULT_SECTIONS.slice();
    let sectionId = previewSection;
    if (previewSection === '__new' && newSection.trim()) { sectionId = 'sec_' + Date.now(); sections = [...sections, { id: sectionId, dev: newSection.trim(), en: '' }]; }
    const entry = {
      id: item.id, name: item.name, title: item.title || null, tradition: item.tradition, deity: item.deity, script: item.script,
      source: item.source, sourceUrl: item.sourceUrl, license: item.license, verses: item.verses,
      verseCount: item.verseCount, lastNumber: item.lastNumber, sectionId,
      audio: { url: '', youtube: DEFAULT_YT[item.id] || '', timings: null, method: null }, addedAt: Date.now(),
    };
    setBook((b) => ({ ...b, sections, items: [...b.items, entry] }));
    setPreview(null); setQuery(''); setNewSection(''); openReader(item.id);
  };
  const removeFromBook = (id) => setBook((b) => ({ ...b, items: b.items.filter((x) => x.id !== id) }));
  const patchItem = (id, patch) => setBook((b) => ({ ...b, items: b.items.map((x) => (x.id === id ? { ...x, ...patch } : x)) }));
  const openReader = (id) => { setReader({ startItemId: id }); setLastReadId(id); };

  // Save a mantra reached from Bhava into the Book (the only book interaction there).
  const saveFromBhava = (item) => {
    if (!item || inBook(item.id)) return;
    const sectionId = guessSection(item.tradition);
    const sections = book.sections.length ? book.sections : DEFAULT_SECTIONS.slice();
    const entry = {
      id: item.id, name: item.name, title: item.title || null, tradition: item.tradition, deity: item.deity, script: item.script,
      source: item.source, sourceUrl: item.sourceUrl, license: item.license, verses: item.verses,
      verseCount: item.verseCount, lastNumber: item.lastNumber, sectionId,
      audio: { url: '', youtube: DEFAULT_YT[item.id] || '', timings: null, method: null }, addedAt: Date.now(),
    };
    setBook((b) => ({ ...b, sections, items: [...b.items, entry] }));
  };

  const secLabel = (s) => (SEC_KEY[s.id] ? t(SEC_KEY[s.id]) : s.dev);
  const grouped = useMemo(() => {
    const secs = book.sections.length ? book.sections : DEFAULT_SECTIONS;
    return secs.map((s) => ({ section: s, items: book.items.filter((it) => it.sectionId === s.id) })).filter((g) => g.items.length);
  }, [book]);

  const navItems = [
    { key: 'home', icon: 'ti-home', label: t('nav_home') },
    { key: 'book', icon: 'ti-book-2', label: t('nav_book') },
    { key: 'bhava', icon: 'ti-mood-heart', label: t('nav_bhava') },
  ];
  const onNav = (k) => setTab(k);

  const Card = ({ it }) => (
    <div className="gcard" style={{ background: gradientFor(it.id) }} onClick={() => openReader(it.id)}>
      <span className="gx" onClick={(e) => { e.stopPropagation(); removeFromBook(it.id); }}>×</span>
      <svg className="rp" viewBox="0 0 100 100" aria-hidden="true"><g fill="none" stroke="#fff" strokeWidth="3"><circle cx="50" cy="50" r="40" /><circle cx="50" cy="50" r="24" /></g></svg>
      <div className="gname">{it.title || it.name}</div>
      <div className="gmeta">{[it.deity, `${it.lastNumber || it.verseCount} ${t('verses')}`].filter(Boolean).join(' · ')}</div>
    </div>
  );

  return (
    <div className="shell">
      <nav className="rail no-print">
        <div className="om">ॐ</div>
        {navItems.map((n) => (
          <div key={n.key} className={`ri ${tab === n.key ? 'on' : ''}`} onClick={() => onNav(n.key)}><i className={`ti ${n.icon}`} aria-hidden="true" /><span>{n.label}</span></div>
        ))}
        <div className="rail-spacer" />
        <div className={`ri ${readyReq ? 'alert' : ''}`} onClick={() => setFeedbackOpen(true)} title={t('fb_open')}><i className={`ti ${readyReq ? 'ti-bell-ringing' : 'ti-bell'}`} aria-hidden="true" />{pending.length && !readyReq ? <span className="ri-dot" /> : null}<span>{t('fb_nav')}</span></div>
        <InstallButton t={t} />
        <div className="ri" onClick={() => setLangModal(true)} title={t('change_language')}><i className="ti ti-language" aria-hidden="true" /><span>{langMeta(lang).native}</span></div>
      </nav>

      <main className="main">
        {readyReq && (
          <div className="req-ready no-print">
            <i className="ti ti-bell-ringing" />
            <div className="req-ready-txt"><b>{t('req_ready_title')}</b><span>{readyReq.name || readyReq.text}</span></div>
            <button className="btn small" onClick={openReady}>{t('req_ready_open')}</button>
            <button className="icon-btn sm" onClick={dismissReady} aria-label={t('close')}><i className="ti ti-x" /></button>
          </div>
        )}
        <div className="view">
          {tab === 'home' && (
            <>
              <section className="hero">
                <InstallButton t={t} />
                <div className="hero-tools">
                  <button className={`globe-btn icon-only ${readyReq ? 'alert' : ''}`} onClick={() => setFeedbackOpen(true)} aria-label={t('fb_open')} title={t('fb_open')}><i className={`ti ${readyReq ? 'ti-bell-ringing' : 'ti-bell'}`} />{pending.length && !readyReq ? <span className="ri-dot" /> : null}</button>
                  <button className="globe-btn" onClick={() => setLangModal(true)} aria-label={t('change_language')}><i className="ti ti-language" /> {langMeta(lang).native}</button>
                </div>
                <Rays /><Halo />
                <h1>MANTRA SANGRAHA</h1>
                <p className="sub">{t('tagline')}</p>
                <div className="searchbar">
                  <div className="searchwrap">
                    <input value={query} placeholder={t('search_ph')} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') doFetch(); }} />
                    {voiceOK && (
                      <button className={`mic ${listening ? 'live' : ''}`} onClick={startVoice} title={t('voice_search')} aria-label={t('voice_search')}><i className={`ti ${listening ? 'ti-microphone-filled' : 'ti-microphone'}`} /></button>
                    )}
                  </div>
                  <button className="btn" onClick={() => doFetch()} disabled={loading || !query.trim()}>{loading ? t('fetching') : t('fetch')}</button>
                </div>
                {listening && <div className="listening-hint">{t('voice_listening')}</div>}

                {suggestions.length ? (
                  <div className="suggests">
                    {suggestions.map((s, i) => (
                      <button key={s.slug || i} className="chip" onClick={() => { setQuery(s.name); doFetch(s.name); }}>{s.name} {s.deity ? <small>· {s.deity}</small> : null}</button>
                    ))}
                  </div>
                ) : (
                  <>
                    <div className="seclbl-min">{t('browse_by_deity')}</div>
                    <div className="browse-row">
                      <div className="deity-scroll">
                        <button className={`dchip ${!deityFilter ? 'on' : ''}`} onClick={() => setDeityFilter(null)}><span className="em" style={{ background: '#ffcf5c' }}>★</span>{t('browse_popular')}</button>
                        {DEITY_GROUPS.filter((g) => (deityMembers[g.key] || []).length).map((g) => (
                          <button key={g.key} className={`dchip ${deityFilter === g.key ? 'on' : ''}`} onClick={() => setDeityFilter(g.key)}><span className="em" style={{ background: g.c }}>ॐ</span>{g.l[lang] || g.l.en}</button>
                        ))}
                      </div>
                      <span className="pa-divider" />
                      <button className="pa-btn" title={t('play_all')} aria-label={t('play_all')}
                        onClick={() => { const list = deityFilter ? (deityMembers[deityFilter] || []) : popularSample; const label = deityFilter ? (DEITY_GROUPS.find((g) => g.key === deityFilter)?.l[lang] || t('browse_popular')) : t('browse_popular'); playAll(list, label); }}>
                        <i className="ti ti-player-play-filled" /> {t('play_all')}
                      </button>
                    </div>
                    {deityFilter ? (
                      <div className="browse-grid">
                        {(deityMembers[deityFilter] || []).map((rec) => (
                          <button key={rec.slug} className="mcard" onClick={() => doFetch(rec.name)}>
                            <span className="mn">{mantraName(rec.slug, lang, rec.name)}</span>
                            <span className="mmeta">{deityLabel(rec.deity, lang)}</span>
                            <span className="rp">ॐ</span>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="suggests">
                        {popularSample.map((rec) => (<button key={rec.slug} className="chip" onClick={() => doFetch(rec.name)}>{mantraName(rec.slug, lang, rec.name)}</button>))}
                      </div>
                    )}
                  </>
                )}
              </section>

              {error && (
                <div className="hint error">{error.message || 'Not found.'}
                  {error.suggestions?.length ? (<div className="suggests" style={{ marginTop: 8 }}>{error.suggestions.map((s) => (<button key={s.slug} className="chip" onClick={() => { setQuery(s.name); doFetch(s.name); }}>{s.name}</button>))}</div>) : null}
                </div>
              )}

              {preview && (
                <div className="card">
                  <h3>{preview.title || preview.name}</h3>
                  <div className="meta">{preview.deity ? `${preview.deity} · ` : ''}{preview.tradition ? `${preview.tradition} · ` : ''}{preview.lastNumber ? `${preview.lastNumber} ${t('verses')}` : `${preview.verseCount}`}</div>
                  <div className="verse-peek">{preview.verses.slice(0, 3).map((v) => v.text).join('\n\n')}</div>
                  {!inBook(preview.id) && (
                    <div className="picker">
                      <div className="pk-t">{t('file_under')}</div>
                      <div className="pk-opts">
                        {(book.sections.length ? book.sections : DEFAULT_SECTIONS).map((s) => (<button key={s.id} className={`pk-opt ${previewSection === s.id ? 'sel' : ''}`} onClick={() => setPreviewSection(s.id)}>{secLabel(s)}</button>))}
                        <span className={`pk-new ${previewSection === '__new' ? 'sel' : ''}`}><input placeholder={t('new_section')} value={newSection} onFocus={() => setPreviewSection('__new')} onChange={(e) => { setNewSection(e.target.value); setPreviewSection('__new'); }} /></span>
                      </div>
                    </div>
                  )}
                  <div className="row">
                    <button className="btn" onClick={() => addToBook(preview)}>{inBook(preview.id) ? t('open_in_book') : t('add_to_book')}</button>
                    <button className="btn ghost small" onClick={() => setPreview(null)}>{t('dismiss')}</button>
                    <span className="src">{t('source')}: <a href={preview.sourceUrl} target="_blank" rel="noreferrer">{preview.source}</a></span>
                  </div>
                </div>
              )}

              {book.items.length > 0 && (<><div className="seclbl" style={{ marginTop: 26 }}>{t('recently_added')}</div><div className="grid">{book.items.slice(-4).reverse().map((it) => <Card key={it.id} it={it} />)}</div></>)}
              <p className="hint">{t('accuracy_note')}</p>
            </>
          )}

          {tab === 'book' && (
            <>
              <div className="view-head"><h2>{t('mybook')}</h2><span className="muted">{book.items.length}</span></div>
              {book.items.length === 0 ? (<p className="empty">{t('mybook_empty')}</p>) : (
                grouped.map((g) => (
                  <div key={g.section.id}><div className="seclbl">{secLabel(g.section)}</div><div className="grid">{g.items.map((it) => <Card key={it.id} it={it} />)}</div></div>
                ))
              )}
            </>
          )}

          {tab === 'bhava' && (<BhavaView t={t} onChant={(pick) => setChant(pick)} />)}
        </div>
      </main>

      <nav className="tabbar no-print">
        {navItems.map((n) => (<div key={n.key} className={`ri ${tab === n.key ? 'on' : ''}`} onClick={() => onNav(n.key)}><i className={`ti ${n.icon}`} aria-hidden="true" /><span>{n.label}</span></div>))}
      </nav>

      {/* continuous "Play all" player */}
      <audio ref={playerAudio} src={qUrl || undefined}
        onLoadStart={() => { if (qUrl) setQLoading(true); }}
        onWaiting={() => setQLoading(true)}
        onCanPlay={() => setQLoading(false)}
        onPlaying={() => { setQLoading(false); setQPlaying(true); }}
        onEnded={() => advance(1, true)} onPlay={() => setQPlaying(true)} onPause={() => setQPlaying(false)}
        onTimeUpdate={(e) => { const a = e.currentTarget; if (a.duration) setQProg((a.currentTime / a.duration) * 100); }} style={{ display: 'none' }} />
      {qi >= 0 && queue[qi] && (
        <div className="nowbar no-print" onClick={() => setQOpen(true)}>
          <span className="np-prog" style={{ width: qProg + '%' }} />
          <span className="np-art">ॐ</span>
          <div className="np-meta"><div className="np-t">{mantraName(queue[qi].slug, lang, queue[qi].name)}</div><div className="np-s">{qLoading ? t('loading_audio') : `${qLabel ? qLabel + ' · ' : ''}${t('recitation')}`}</div></div>
          <button className="icon-btn" onClick={(e) => { e.stopPropagation(); togglePlay(); }} disabled={qLoading} aria-label="play/pause"><i className={`ti ${qLoading ? 'ti-loader-2 spin' : (qPlaying ? 'ti-player-pause-filled' : 'ti-player-play-filled')}`} /></button>
          <button className="icon-btn" onClick={(e) => { e.stopPropagation(); advance(1, false); }} aria-label="next"><i className="ti ti-player-track-next-filled" /></button>
          <button className="icon-btn" onClick={(e) => { e.stopPropagation(); setQi(-1); setQUrl(''); setQOpen(false); }} aria-label={t('close')}><i className="ti ti-x" /></button>
        </div>
      )}
      {qOpen && qi >= 0 && queue[qi] && (
        <div className="player-ov no-print">
          <div className="pov-top"><button className="icon-btn" onClick={() => setQOpen(false)}><i className="ti ti-chevron-down" /></button><span className="pov-h">{qLabel} · {t('play_all')}</span><span style={{ width: 38 }} /></div>
          <div className="pov-art"><Rays /><span className="pov-om">ॐ</span></div>
          <div className="pov-t">{mantraName(queue[qi].slug, lang, queue[qi].name)}</div>
          <div className="pov-s">{qLoading ? t('loading_audio') : [deityLabel(queue[qi].deity, lang), t('recitation')].filter(Boolean).join(' · ')}</div>
          <div className="pov-progbar"><i style={{ width: qProg + '%' }} /></div>
          <div className="pov-ctrls">
            <button className="icon-btn lg" onClick={() => advance(-1, false)} aria-label="previous"><i className="ti ti-player-track-prev-filled" /></button>
            <button className="icon-btn big" onClick={togglePlay} disabled={qLoading} aria-label="play/pause"><i className={`ti ${qLoading ? 'ti-loader-2 spin' : (qPlaying ? 'ti-player-pause-filled' : 'ti-player-play-filled')}`} /></button>
            <button className="icon-btn lg" onClick={() => advance(1, false)} aria-label="next"><i className="ti ti-player-track-next-filled" /></button>
          </div>
          <div className="pov-qh">{t('up_next')}</div>
          <div className="pov-queue">
            {queue.map((it, i) => (<div key={i} className={`pov-qrow ${i === qi ? 'on' : ''}`} onClick={() => setQi(i)}><i className={`ti ${i === qi ? 'ti-volume' : 'ti-player-play'}`} />{mantraName(it.slug, lang, it.name)}</div>))}
          </div>
        </div>
      )}

      {langModal && <LangModal current={lang} onChoose={chooseLang} onClose={() => setLangModal(false)} firstRun={!loaded || !localStorageHas(LANG_KEY)} />}
      {feedbackOpen && <FeedbackSheet t={t} lang={lang} script={script} onClose={() => setFeedbackOpen(false)} onSubmitted={onFeedbackSubmitted} />}
      {reader && <Reader t={t} book={book} startItemId={reader.startItemId} onClose={() => setReader(null)} patchItem={patchItem} onRemove={removeFromBook} />}
      {chant && <ChantMeditation t={t} lang={lang} pick={chant} script={script} inBook={inBook(chant.q)} onClose={() => setChant(null)} onSave={saveFromBhava} />}
    </div>
  );
}

function localStorageHas(k) { try { return localStorage.getItem(k) != null; } catch { return false; } }

// One-tap PWA install. On Android/desktop Chromium we capture the browser's
// `beforeinstallprompt` and fire the native install on click (no Settings, no
// manual "Add to Home Screen"). iOS Safari has no such API, so there we show the
// share-sheet instructions. Hidden when already installed / not installable.
function InstallButton({ t }) {
  const [mounted, setMounted] = useState(false); // avoid SSR/client hydration mismatch
  const [deferred, setDeferred] = useState(null);
  const [installed, setInstalled] = useState(false);
  const [hint, setHint] = useState(false);
  useEffect(() => {
    setMounted(true);
    const onBip = (e) => { e.preventDefault(); setDeferred(e); };
    const onInstalled = () => { setInstalled(true); setDeferred(null); };
    window.addEventListener('beforeinstallprompt', onBip);
    window.addEventListener('appinstalled', onInstalled);
    try {
      if ((window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || window.navigator.standalone) setInstalled(true);
    } catch {}
    return () => { window.removeEventListener('beforeinstallprompt', onBip); window.removeEventListener('appinstalled', onInstalled); };
  }, []);
  const isIOS = mounted && typeof navigator !== 'undefined' && /iphone|ipad|ipod/i.test(navigator.userAgent);
  if (!mounted || installed) return null; // render nothing on the server + first client paint
  if (!deferred && !isIOS) return null;   // not installable yet on this browser
  const onClick = async () => {
    if (deferred) { deferred.prompt(); try { await deferred.userChoice; } catch {} setDeferred(null); return; }
    setHint(true); // iOS: show manual instructions
  };
  return (
    <>
      <button className="install-btn no-print" onClick={onClick}><i className="ti ti-download" /> <span>{t('install_app')}</span></button>
      {hint && (
        <div className="ios-hint" onClick={() => setHint(false)}>
          <div className="ios-hint-box" onClick={(e) => e.stopPropagation()}>
            <b>{t('install_app')}</b>
            <p>{t('install_ios_hint')}</p>
            <button className="btn small" onClick={() => setHint(false)}>OK</button>
          </div>
        </div>
      )}
    </>
  );
}

// Suggest / feedback sheet — one entry point, two intents (request a mantra or
// share feedback). Posts to /api/feedback. The honeypot input catches bots.
function FeedbackSheet({ t, lang, script, onClose, onSubmitted }) {
  const [kind, setKind] = useState('mantra');
  const [text, setText] = useState('');
  const [contact, setContact] = useState('');
  const [hp, setHp] = useState(''); // honeypot — must stay empty for humans
  const [rating, setRating] = useState(0); // 0 = not rated (feedback only)
  const [state, setState] = useState(''); // '' | 'sending' | 'error'
  const [done, setDone] = useState(false);

  const submit = async () => {
    const v = text.trim();
    if (!v || state === 'sending') return;
    setState('sending');
    try {
      const r = await fetch('/api/feedback', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind, text: v, contact: contact.trim(), rating: kind === 'feedback' ? rating : 0, lang, script, version: APP_VERSION, client: clientId(), website: hp }),
      });
      const j = await r.json();
      if (j.ok) { setDone(true); if (onSubmitted) onSubmitted(kind, v); }
      else setState('error');
    } catch { setState('error'); }
  };

  return (
    <div className="lang-modal" onClick={onClose}>
      <div className="fb-card" onClick={(e) => e.stopPropagation()}>
        {done ? (
          <div className="fb-done">
            <div className="fb-check">🙏</div>
            <h3>{t('fb_thanks')}</h3>
            <p>{kind === 'mantra' ? t('fb_thanks_mantra') : t('fb_thanks_feedback')}</p>
            <button className="btn" onClick={onClose}>{t('close')}</button>
          </div>
        ) : (
          <>
            <h3>{t('fb_title')}</h3>
            <div className="fb-toggle">
              <button className={kind === 'mantra' ? 'on' : ''} onClick={() => setKind('mantra')}>{t('fb_kind_mantra')}</button>
              <button className={kind === 'feedback' ? 'on' : ''} onClick={() => setKind('feedback')}>{t('fb_kind_feedback')}</button>
            </div>
            {kind === 'feedback' && (
              <div className="fb-rate">
                <span className="fb-rate-label">{t('fb_rate')}</span>
                <div className="fb-stars">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button key={n} type="button" className={`fb-star ${n <= rating ? 'on' : ''}`} onClick={() => setRating(n === rating ? 0 : n)} aria-label={`${n} / 5`}>
                      <i className={`ti ${n <= rating ? 'ti-star-filled' : 'ti-star'}`} />
                    </button>
                  ))}
                </div>
              </div>
            )}
            <textarea className="fb-text" rows={4} value={text} onChange={(e) => setText(e.target.value)} placeholder={kind === 'mantra' ? t('fb_ph_mantra') : t('fb_ph_feedback')} />
            <input className="fb-contact" value={contact} onChange={(e) => setContact(e.target.value)} placeholder={t('fb_contact_ph')} />
            <input className="fb-hp" tabIndex={-1} autoComplete="off" value={hp} onChange={(e) => setHp(e.target.value)} aria-hidden="true" />
            {state === 'error' && <div className="fb-err">{t('fb_error')}</div>}
            <div className="fb-actions">
              <button className="btn ghost small" onClick={onClose}>{t('close')}</button>
              <button className="btn" disabled={!text.trim() || state === 'sending'} onClick={submit}>{state === 'sending' ? t('fb_sending') : t('fb_send')}</button>
            </div>
            <p className="fb-note">{t('fb_privacy')} · <a href="/privacy" target="_blank" rel="noreferrer">{t('privacy_policy')}</a></p>
          </>
        )}
      </div>
    </div>
  );
}

function LangModal({ current, onChoose, onClose, firstRun }) {
  const [sel, setSel] = useState(current);
  // Preview the picker's own text in the language you're hovering/selecting,
  // so choosing English immediately shows English (not the previous language).
  const tt = (k) => translate(sel, k);
  return (
    <div className="lang-modal" onClick={firstRun ? undefined : onClose}>
      <div className="lang-box" onClick={(e) => e.stopPropagation()}>
        <div className="lang-om">ॐ</div>
        <h2>{tt('lang_choose_title')}</h2>
        <p>{tt('lang_choose_sub')}</p>
        <div className="lang-grid">
          {LANGS.map((l) => (
            <button key={l.code} className={`lang-card ${sel === l.code ? 'sel' : ''}`} onClick={() => setSel(l.code)}>
              <span className="ln-native">{l.native}</span>
              <span className="ln-name">{l.name}</span>
            </button>
          ))}
        </div>
        <button className="btn" onClick={() => onChoose(sel)}>{tt('lang_continue')}</button>
      </div>
    </div>
  );
}

const MYFEEL_KEY = 'mantra-sangraha-myfeelings-v1';

// Feeling / Meditation — pick a mantra (feeling → mantra), saved locally, and
// open it in the full chant-meditation (verses + auto recitation + drone).
// The former OpenAI mood-search was removed; everything else is unchanged.
function BhavaView({ t, onChant }) {
  const [mine, setMine] = useState([]);
  const [adding, setAdding] = useState(false);
  const [feelIn, setFeelIn] = useState('');
  const [mIn, setMIn] = useState('');
  const [sugg, setSugg] = useState([]);
  const [chosen, setChosen] = useState(null);
  useEffect(() => { try { setMine(JSON.parse(localStorage.getItem(MYFEEL_KEY) || '[]')); } catch {} }, []);
  const persistMine = (list) => { setMine(list); try { localStorage.setItem(MYFEEL_KEY, JSON.stringify(list)); } catch {} };
  useEffect(() => {
    const term = mIn.trim(); if (!term || chosen) { setSugg([]); return; }
    const tmr = setTimeout(async () => {
      try { const r = await fetch(`/api/search?q=${encodeURIComponent(term)}`); const j = await r.json(); setSugg(j.results || []); } catch {}
    }, 200);
    return () => clearTimeout(tmr);
  }, [mIn, chosen]);
  const addMine = () => {
    if (!chosen) return;
    const entry = { feeling: feelIn.trim(), q: chosen.slug, name: chosen.name, deity: chosen.deity || '' };
    persistMine([...mine.filter((x) => !(x.q === entry.q && x.feeling === entry.feeling)), entry]);
    setAdding(false); setFeelIn(''); setMIn(''); setChosen(null); setSugg([]);
  };
  const removeMine = (i) => persistMine(mine.filter((_, idx) => idx !== i));
  return (
    <>
      <div className="bhava-head"><div className="dev">॥ भाव ॥</div><h2>{t('bhava_title')}</h2><p>{t('bhava_sub')}</p></div>

      <div className="seclbl myfeel-head">
        <span><i className="ti ti-heart" /> {t('my_picks')}</span>
        <button className="chip add-chip" onClick={() => setAdding((a) => !a)}><i className={`ti ${adding ? 'ti-x' : 'ti-plus'}`} /> {t('add_own')}</button>
      </div>
      {adding && (
        <div className="add-feeling">
          <div className="add-t">{t('add_own_title')}</div>
          <input className="af-in" placeholder={t('feeling_ph')} value={feelIn} onChange={(e) => setFeelIn(e.target.value)} />
          <input className="af-in" placeholder={t('mantra_ph')} value={chosen ? chosen.name : mIn} onChange={(e) => { setChosen(null); setMIn(e.target.value); }} />
          {!chosen && sugg.length > 0 && (
            <div className="add-sugg">
              {sugg.slice(0, 6).map((s, i) => (<button key={i} className="chip" onClick={() => { setChosen({ slug: s.slug, name: s.name, deity: s.deity }); setMIn(s.name); setSugg([]); }}>{s.name}{s.deity ? <small> · {s.deity}</small> : null}</button>))}
            </div>
          )}
          <div className="add-actions">
            <button className="btn small" disabled={!chosen} onClick={addMine}>{t('save_word')}</button>
            <button className="btn ghost small" onClick={() => { setAdding(false); setFeelIn(''); setMIn(''); setChosen(null); setSugg([]); }}>{t('cancel_word')}</button>
          </div>
        </div>
      )}
      {mine.length > 0 ? (
        <div className="grid">
          {mine.map((p, i) => (
            <div key={i} className="gcard" style={{ background: gradientFor(p.q) }} onClick={() => onChant({ q: p.q, name: p.name, deity: p.deity })}>
              <span className="gx" onClick={(e) => { e.stopPropagation(); removeMine(i); }}>×</span>
              <svg className="rp" viewBox="0 0 100 100" aria-hidden="true"><g fill="none" stroke="#fff" strokeWidth="3"><circle cx="50" cy="50" r="40" /><circle cx="50" cy="50" r="24" /></g></svg>
              <div className="gname">{p.name}</div>
              <div className="gmeta">{[p.deity, p.feeling].filter(Boolean).join(' · ')}</div>
              <span className="chant-go"><i className="ti ti-player-play" /></span>
            </div>
          ))}
        </div>
      ) : (!adding && <p className="hint" style={{ marginTop: 4 }}>{t('add_own_title')}.</p>)}
      <p className="hint" style={{ marginTop: 20 }}>{t('bhava_note')}</p>
    </>
  );
}

// A soft, always-available tanpura-style drone synthesized in the browser
// (Sa–Pa–Sa), so the meditation has ambient sound even when no recitation exists.
function createDrone() {
  try {
    const AC = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
    if (!AC) return null;
    const ctx = new AC();
    const ON = 0.5;
    // master carries the constant level + the LFO breath-swell; a SEPARATE mute
    // gate after it hard-cuts to exactly 0 so muting is truly silent (the swell
    // LFO modulates master, so muting master alone leaves an audible residue).
    const master = ctx.createGain();
    master.gain.value = ON;
    // gentle low-pass — high enough that mid harmonics (audible on phones/laptops) pass through
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 2400; lp.Q.value = 0.3;
    const mute = ctx.createGain();
    mute.gain.value = 0; // starts silent until setOn(true)
    master.connect(lp); lp.connect(mute); mute.connect(ctx.destination);

    const voices = [];
    // Sa–Pa–Sa around the mid register where small speakers are efficient, +octave shimmer
    const notes = [196.0, 293.66, 392.0, 587.33]; // G3, D4, G4, D5
    const level = [0.5, 0.34, 0.26, 0.12];
    notes.forEach((f, i) => {
      [-6, 6].forEach((det) => {
        const o = ctx.createOscillator();
        o.type = 'triangle'; o.frequency.value = f; o.detune.value = det;
        const g = ctx.createGain(); g.gain.value = level[i] * 0.5;
        o.connect(g); g.connect(master); o.start(); voices.push(o);
      });
    });
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.08; // slow breath-like swell
    const lg = ctx.createGain(); lg.gain.value = 0.05;
    lfo.connect(lg); lg.connect(master.gain); lfo.start(); voices.push(lfo);

    return {
      resume: () => { try { if (ctx.state !== 'running') ctx.resume(); } catch {} },
      setOn: (on) => {
        try {
          const now = ctx.currentTime;
          mute.gain.cancelScheduledValues(now);
          mute.gain.setValueAtTime(mute.gain.value, now);
          mute.gain.linearRampToValueAtTime(on ? 1 : 0, now + 0.12); // reaches EXACTLY 0 → full mute
        } catch {}
      },
      state: () => (ctx ? ctx.state : 'closed'),
      close: () => { try { voices.forEach((v) => v.stop()); ctx.close(); } catch {} },
    };
  } catch { return null; }
}

// Pick a symbolic emblem + accent colour for a deity. Symbols (not photos) keep
// it licence-safe and always-available; we can swap in commissioned art later.
function deityTheme(deity) {
  const d = String(deity || '').toLowerCase();
  if (/shiv|rudra|shankar|mahesh|nataraj|tandav|bhairav|mrityunj|linga|jyotir|somnath|pashupat|dakshina/.test(d)) return { glyph: 'trishul', c1: '#8fd3ff' };
  if (/vishnu|narayan|purush|venkat|balaji|ram|krishn|hari|govind|narasimha|nrusimha|jagannath|padmanabh|hayagriv|kesava|madhav/.test(d)) return { glyph: 'chakra', c1: '#ffd27a' };
  if (/lakshmi|kanakadhara|kamala|sridevi/.test(d)) return { glyph: 'lotus', c1: '#ffcf6b' };
  if (/devi|durga|parvati|amba|gauri|lalita|mahishasura|bhavani|shakti|saraswati|kali|chandi|meenakshi|kamakshi|annapurna|tripura/.test(d)) return { glyph: 'lotus', c1: '#ff9ad6' };
  if (/ganesh|ganapati|vinayak|vigneshwar|gajanan/.test(d)) return { glyph: 'om', c1: '#ffb45c' };
  if (/hanuman|anjaneya|maruti|bajrang/.test(d)) return { glyph: 'om', c1: '#ff9a5c' };
  if (/surya|aditya|ravi|bhaskar/.test(d)) return { glyph: 'chakra', c1: '#ffd27a' };
  return { glyph: 'om', c1: '#ffcf6b' };
}
function glyphSvg(kind) {
  if (kind === 'trishul') {
    return (
      <svg viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <line x1="50" y1="30" x2="50" y2="88" /><line x1="50" y1="30" x2="50" y2="6" />
        <path d="M30 42 C27 26 34 20 34 14 L34 8" /><path d="M70 42 C73 26 66 20 66 14 L66 8" />
        <path d="M28 42 Q50 54 72 42" /><line x1="43" y1="62" x2="57" y2="62" />
      </svg>
    );
  }
  if (kind === 'chakra') {
    return (
      <svg viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden="true">
        <circle cx="50" cy="50" r="30" /><circle cx="50" cy="50" r="9" />
        {Array.from({ length: 12 }).map((_, i) => <line key={i} x1="50" y1="21" x2="50" y2="41" transform={`rotate(${i * 30} 50 50)`} />)}
      </svg>
    );
  }
  if (kind === 'lotus') {
    return (
      <svg viewBox="0 0 100 100" fill="currentColor" aria-hidden="true"><g opacity="0.92">
        {Array.from({ length: 8 }).map((_, i) => <ellipse key={i} cx="50" cy="33" rx="8" ry="18" transform={`rotate(${i * 45} 50 50)`} />)}
        <circle cx="50" cy="50" r="7" opacity="0.55" />
      </g></svg>
    );
  }
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true"><text x="50" y="73" fontSize="66" textAnchor="middle" fill="currentColor" style={{ fontFamily: 'var(--deva)' }}>ॐ</text></svg>
  );
}
// The meditation centrepiece: a cinematic, breathing deity emblem — no counter,
// no fixed number of repetitions. Rays spin, a soft ring frames it, the glyph
// pulses with the breath. Chant as long as you like.
function DeityScene({ deity }) {
  const th = deityTheme(deity);
  return (
    <>
      <svg className="ds-rays" viewBox="0 0 100 100" aria-hidden="true"><g fill={th.c1} opacity="0.5">
        {Array.from({ length: 24 }).map((_, i) => <polygon key={i} points="49.6,3 50.4,3 50,46" transform={`rotate(${i * 15} 50 50)`} />)}
      </g></svg>
      <svg className="ds-ring" width="176" height="176" viewBox="0 0 176 176" aria-hidden="true">
        <circle cx="88" cy="88" r="62" fill="none" stroke={th.c1} strokeWidth="4" opacity="0.4"
          style={{ filter: `drop-shadow(0 0 6px ${th.c1})` }} />
      </svg>
      <div className="ds-glyph" style={{ color: th.c1 }}>{glyphSvg(th.glyph)}</div>
    </>
  );
}

function ChantMeditation({ t, lang, pick, script, inBook, onClose, onSave }) {
  const [data, setData] = useState(null);
  const [meanings, setMeanings] = useState({});
  const [status, setStatus] = useState('loading');
  const [vi, setVi] = useState(0);
  const [saved, setSaved] = useState(!!inBook);
  // Remember the drone mute choice across opens (default on the first time).
  const [sound, setSound] = useState(() => { try { return localStorage.getItem('mantra-sangraha-drone') !== 'off'; } catch { return true; } });
  const toggleSound = () => { droneRef.current?.resume(); setSound((s) => { const n = !s; try { localStorage.setItem('mantra-sangraha-drone', n ? 'on' : 'off'); } catch {} return n; }); };
  const [recite, setRecite] = useState(null);
  const [reciteDone, setReciteDone] = useState(false); // recitation lookup finished
  const [reciteErr, setReciteErr] = useState(false);
  const [reciteUnavail, setReciteUnavail] = useState(false); // archive search down
  const [alts, setAlts] = useState([]);
  const [audioBusy, setAudioBusy] = useState(false);
  const [toast, setToast] = useState('');
  const droneRef = useRef(null);

  useEffect(() => {
    let c = false; setStatus('loading'); setData(null); setMeanings({}); setVi(0); setRecite(null); setAlts([]); setReciteDone(false); setReciteErr(false); setReciteUnavail(false);
    (async () => {
      try {
        const r = await fetch(`/api/fetch?mantra=${encodeURIComponent(pick.q)}&script=${encodeURIComponent(script)}`);
        const j = await r.json();
        if (c) return;
        if (j.ok) {
          setData(j); setStatus('');
          try {
            // meaning text is English; the Devanagari meaning page parses most reliably
            const rm = await fetch(`/api/meaning?mantra=${encodeURIComponent(pick.q)}&script=devanagari`);
            const jm = await rm.json(); if (!c && jm.ok) setMeanings(jm.meanings || {});
          } catch {}
          // Recitation: reuse the user's previously-chosen track for this mantra
          // if any (saved for next time, exactly like the book); else auto-find.
          const pref = loadAudioPref(pick.q);
          if (pref && pref.url) { if (!c) setRecite(pref); }
          else {
            try {
              const ra = await fetch(`/api/audio?slug=${encodeURIComponent(j.id || pick.q)}&name=${encodeURIComponent(j.name || j.title || pick.name || '')}`);
              const ja = await ra.json();
              if (!c && ja.ok && ja.url) {
                const rec = { url: ja.url, label: ja.title, src: ja.sourceUrl, itemId: ja.itemId || null };
                setRecite(rec); setAlts(ja.alternatives || []); saveAudioPref(pick.q, rec);
              } else if (!c && ja.error === 'search_failed') setReciteUnavail(true);
            } catch { if (!c) setReciteUnavail(true); }
          }
          if (!c) setReciteDone(true);
        } else setStatus('error');
      } catch { if (!c) setStatus('error'); }
    })();
    return () => { c = true; };
  }, [pick.q, script]);

  // Switch to a different reciter/voice — saved for next time (same as the book).
  const anotherVoice = async () => {
    if (audioBusy) return;
    setAudioBusy(true); setReciteErr(false);
    const nm = (data && (data.name || data.title)) || pick.name || '';
    try {
      const sl = (data && data.id) || pick.q;
      let list = alts;
      if (!list.length) {
        const r = await fetch(`/api/audio?slug=${encodeURIComponent(sl)}&name=${encodeURIComponent(nm)}`);
        const j = await r.json(); list = (j.ok && j.alternatives) ? j.alternatives : []; setAlts(list);
      }
      if (list.length < 2) { setAudioBusy(false); return; }
      const curIdx = recite && recite.itemId ? list.findIndex((a) => a.itemId === recite.itemId) : -1;
      const next = ((curIdx < 0 ? 0 : curIdx) + 1) % list.length;
      const cand = list[next];
      // Index feeds already carry the resolved url — switch instantly, no search.
      if (cand.url) { const rec = { url: cand.url, label: cand.title, src: cand.sourceUrl, itemId: cand.itemId || null }; setRecite(rec); saveAudioPref(pick.q, rec); }
      else {
        const rr = await fetch(`/api/audio?item=${encodeURIComponent(cand.itemId)}&name=${encodeURIComponent(nm)}`);
        const jj = await rr.json();
        if (jj.ok && jj.url) { const rec = { url: jj.url, label: jj.title, src: jj.sourceUrl, itemId: jj.itemId || null }; setRecite(rec); saveAudioPref(pick.q, rec); }
      }
    } catch {}
    finally { setAudioBusy(false); }
  };

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // background drone
  useEffect(() => {
    const d = createDrone(); droneRef.current = d;
    if (d) { d.resume(); d.setOn(sound); }
    return () => { if (d) d.close(); };
  }, []);
  useEffect(() => { const d = droneRef.current; if (d) { d.resume(); d.setOn(sound); } }, [sound]);

  const verses = (data && data.verses) || [];
  const verse = verses[vi];
  const changeVerse = (d) => setVi((i) => Math.max(0, Math.min(verses.length - 1, i + d)));
  const vLines = verse ? String(verse.text || '').split('\n').map((s) => s.trim()).filter(Boolean) : [];
  const meaning = verse ? meanings[verse.n] : null;
  const name = (data && (data.title || data.name)) || pick.name;

  return (
    <div className="chant" onPointerDown={() => { const d = droneRef.current; if (d) { d.resume(); d.setOn(sound); } }}>
      <Rays color="#c98af0" className="rrays" /><Halo className="rhalo" om="#ffe6a0" />
      <div className="chant-top">
        <button className="icon-btn" onClick={onClose} aria-label={t('close')}>✕</button>
        <span className="title">{name}</span>
        <button className={`icon-btn ${sound ? 'on' : ''}`} onClick={toggleSound} aria-label="drone" title="background drone">
          <i className={`ti ${sound ? 'ti-volume' : 'ti-volume-off'}`} />
        </button>
        <button className={`icon-btn ${saved ? 'on' : ''}`} onClick={() => { if (!saved && data) { onSave(data); setSaved(true); setToast(t('saved_toast')); setTimeout(() => setToast(''), 2200); } }} title={t('save_to_book')} aria-label={t('save_to_book')}>
          <i className={`ti ${saved ? 'ti-bookmark-filled' : 'ti-bookmark'}`} />
        </button>
      </div>
      {toast && <div className="chant-toast">{toast}</div>}

      {status === 'loading' && <div className="chant-mid"><p className="empty">…</p></div>}
      {status === 'error' && <div className="chant-mid"><p className="empty">{t('mood_none')}</p></div>}
      {status === '' && verse && (
        <div className="chant-mid">
          <div className="chant-verse">{vLines.map((l, i) => <div key={i} className="cvline">{l}</div>)}</div>

          <div className="breathe-wrap running" onClick={() => droneRef.current?.resume()} role="img" aria-label={(data && data.deity) || pick.deity || 'deity'}>
            <div className="breathe" />
            <DeityScene deity={(data && data.deity) || pick.deity} />
          </div>

          <div className="cue"><span className="mdev">श्वसतु</span> · {t('breathe_cue')}</div>

          {meaning && <div className="chant-meaning">{meaning}</div>}

          <div className="chant-bar">
            <button className="icon-btn" onClick={() => changeVerse(-1)} disabled={vi === 0}>‹</button>
            <span className="cverse-label">{verse.invocation ? 'ध्यानम्' : verse.colophon ? '—' : `॥ ${verse.n} ॥`} · {vi + 1}/{verses.length}</span>
            <button className="icon-btn" onClick={() => changeVerse(1)} disabled={vi >= verses.length - 1}>›</button>
          </div>

          {recite && !reciteErr && (
            <div className="chant-recite">
              <div className="chant-player">
                <audio controls src={recite.url} onError={() => setReciteErr(true)} />
                <button className="icon-btn sm shuffle-in" onClick={anotherVoice} disabled={audioBusy} title={t('another_voice')} aria-label={t('another_voice')}><i className={`ti ${audioBusy ? 'ti-loader-2 spin' : 'ti-arrows-shuffle'}`} /></button>
              </div>
            </div>
          )}
          {reciteDone && reciteUnavail && !recite && (
            <div className="audio-none"><i className="ti ti-wifi-off" /> {t('audio_unavailable')}</div>
          )}
          {reciteDone && !reciteUnavail && (!recite || reciteErr) && (
            <div className="audio-none"><i className="ti ti-music-off" /> {t('audio_none')}
              {alts.length > 1 && <button className="icon-btn sm" style={{ marginLeft: 8 }} onClick={anotherVoice} disabled={audioBusy} title={t('another_voice')}><i className={`ti ${audioBusy ? 'ti-loader-2 spin' : 'ti-arrows-shuffle'}`} /></button>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ===========================================================================

function Reader({ t, book, startItemId, onClose, patchItem, onRemove }) {
  const { pages, toc, firstPageOf } = useMemo(() => buildPages(book), [book]);
  const [pageIndex, setPageIndex] = useState(firstPageOf[startItemId] ?? 0);
  const [dir, setDir] = useState('next');
  const [showToc, setShowToc] = useState(false);
  const [status, setStatus] = useState('');
  const [activeLine, setActiveLine] = useState(-1);
  const [uploadUrl, setUploadUrl] = useState('');
  const [uniformFs, setUniformFs] = useState(20);
  const [readMode, setReadMode] = useState('book'); // 'book' | 'large'
  const [auto, setAuto] = useState(false);
  const [audioBusy, setAudioBusy] = useState(false);
  const [alts, setAlts] = useState([]); const [altIdx, setAltIdx] = useState(-1);
  const [showManual, setShowManual] = useState(false);
  const [audioErr, setAudioErr] = useState(false);
  const [noAudioReason, setNoAudioReason] = useState(''); // '' | 'none' | 'unavailable'
  const [offUrl, setOffUrl] = useState('');               // object URL of the on-device copy
  const [offState, setOffState] = useState('none');       // 'none' | 'saving' | 'saved'
  const audioRef = useRef(null); const uploadRef = useRef(null); const uploadBlobRef = useRef({}); const boxRef = useRef(null); const touchX = useRef(null);

  useEffect(() => { try { const m = localStorage.getItem('mantra-sangraha-readmode'); if (m === 'book' || m === 'large') setReadMode(m); } catch {} }, []);
  useEffect(() => { try { localStorage.setItem('mantra-sangraha-readmode', readMode); } catch {} }, [readMode]);

  const page = pages[pageIndex];
  const item = page ? book.items.find((it) => it.id === page.itemId) : null;
  const prevPage = pageIndex > 0 ? pages[pageIndex - 1] : null;
  const flat = useMemo(() => (item ? flatLinesOf(item) : []), [item]);
  const audioMeta = item?.audio || {};
  const timings = audioMeta.timings || null;
  const audioSrc = offUrl || uploadUrl || audioMeta.url || ''; // prefer the offline copy
  const isFile = !!audioSrc;                       // a real mp3 (syncable)
  const hasAudio = !!(audioSrc || audioMeta.youtube);

  const goTo = useCallback((idx, back) => { if (idx < 0 || idx >= pages.length || idx === pageIndex) return; setDir(back ? 'prev' : 'next'); setPageIndex(idx); }, [pageIndex, pages.length]);
  const go = useCallback((d) => goTo(pageIndex + d, d < 0), [goTo, pageIndex]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'ArrowRight') go(1); else if (e.key === 'ArrowLeft') go(-1); else if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey);
  }, [go, onClose]);

  // One uniform font size per mantra (recomputed on mantra change / resize).
  useEffect(() => {
    const measure = () => { if (boxRef.current && item) setUniformFs(measureUniform(boxRef.current, item.verses)); };
    const id = setTimeout(measure, 0);
    window.addEventListener('resize', measure);
    return () => { clearTimeout(id); window.removeEventListener('resize', measure); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item?.id, readMode]);

  // Hands-free auto page-turn (great for reading along without tapping).
  useEffect(() => {
    if (!auto) return;
    const id = setInterval(() => {
      setDir('next');
      setPageIndex((p) => (p < pages.length - 1 ? p + 1 : p));
    }, 7000);
    return () => clearInterval(id);
  }, [auto, pages.length]);

  // Tap the left/right side, or swipe, to turn the page.
  const onTouchStart = (e) => { touchX.current = e.touches?.[0]?.clientX ?? null; };
  const onTouchEnd = (e) => {
    if (touchX.current == null) return;
    const dx = (e.changedTouches?.[0]?.clientX ?? touchX.current) - touchX.current;
    if (dx > 45) go(-1); else if (dx < -45) go(1);
    touchX.current = null;
  };

  const lineShift = audioMeta.lineShift || 0; // manual correction if highlight leads/lags the voice
  const follow = audioMeta.follow !== false;  // karaoke follow (highlight + auto page-turn) on/off
  const onTimeUpdate = () => {
    const a = audioRef.current; if (!a || !timings || !timings.length || !item || !follow) return;
    const raw = currentLineIndex(timings, a.currentTime);
    const idx = raw < 0 ? -1 : Math.max(0, Math.min(timings.length - 1, raw + lineShift));
    setActiveLine(idx);
    if (idx >= 0 && flat[idx]) { const target = (firstPageOf[item.id] ?? 0) + flat[idx].verseIdx; if (target !== pageIndex) goTo(target, target < pageIndex); }
  };
  const nudgeSync = (d) => { if (item) patchItem(item.id, { audio: { ...audioMeta, lineShift: Math.max(-15, Math.min(15, lineShift + d)) } }); };
  const toggleFollow = () => { if (!item) return; const nf = !follow; if (!nf) setActiveLine(-1); patchItem(item.id, { audio: { ...audioMeta, follow: nf } }); };
  const onUpload = (e) => { const f = e.target.files?.[0]; if (!f || !item) return; uploadBlobRef.current[item.id] = f; setUploadUrl(URL.createObjectURL(f)); setStatus('Audio loaded — tap “Auto-sync words”.'); };
  const runSync = async () => {
    if (!item) return; const source = uploadBlobRef.current[item.id] || audioMeta.url;
    if (!source) { setStatus('Add a recitation (mp3 upload or CC URL) first.'); return; }
    if (!flat.length) return; setStatus('Listening for the pauses between lines…');
    try {
      const res = await alignLines(source, flat.length);
      patchItem(item.id, { audio: { ...audioMeta, timings: res.segments, method: res.method } });
      setStatus(res.method === 'silence' ? `Synced ${flat.length} lines by their pauses. Press play.` : `Pauses unclear — lines split evenly (${flat.length}).`);
    } catch (err) { setStatus(`Couldn’t analyse this audio (${String(err.message || err)}). YouTube can’t be synced — use an mp3 or CC URL.`); }
  };

  // Ad-free recitation lookup (archive.org). Fills the CC-audio URL so it plays
  // AND can be karaoke-synced. Manual paste/upload always override this.
  const applyAudio = (j, opts = {}) => {
    setUploadUrl(''); setAudioErr(false);
    patchItem(item.id, {
      audio: {
        ...audioMeta, url: j.url, youtube: '', timings: null, method: null, lineShift: 0, autoTried: true,
        itemId: j.itemId || null, userPicked: !!opts.userPicked, attrib: { label: j.title || 'Recitation', url: j.sourceUrl },
      },
    });
    setStatus(t('recitation_found'));
  };
  const findRecitation = async () => {
    if (!item || audioBusy) return;
    setAudioBusy(true); setStatus(t('searching_recitation')); setNoAudioReason('');
    try {
      const r = await fetch(`/api/audio?slug=${encodeURIComponent(item.id)}&name=${encodeURIComponent(item.name || item.title || '')}`);
      const j = await r.json();
      if (j.ok && j.url) { setAlts(j.alternatives || []); setAltIdx(0); applyAudio(j); }
      else if (j.error === 'search_failed') { setNoAudioReason('unavailable'); setStatus(t('audio_unavailable')); } // archive down — don't mark autoTried, retry later
      else { patchItem(item.id, { audio: { ...audioMeta, autoTried: true } }); setNoAudioReason('none'); setStatus(t('no_recitation')); }
    } catch { setNoAudioReason('unavailable'); setStatus(t('audio_unavailable')); }
    finally { setAudioBusy(false); }
  };
  // Save the current recitation to the device (IndexedDB) for offline playback.
  const downloadOffline = async () => {
    if (!item || !audioMeta.url || offState === 'saving') return;
    setOffState('saving'); setStatus(t('offline_saving'));
    try {
      const res = await fetch(audioMeta.url);
      if (!res.ok) throw new Error('fetch');
      const blob = await res.blob();
      await saveAudioBlob(item.id, blob);
      if (offUrl) URL.revokeObjectURL(offUrl);
      const u = URL.createObjectURL(blob);
      setOffUrl(u); setOffState('saved'); setStatus(t('offline_saved'));
      patchItem(item.id, { audio: { ...audioMeta, offline: true } });
    } catch { setOffState('none'); setStatus(t('audio_unavailable')); }
  };
  const removeOffline = async () => {
    if (!item) return;
    await removeAudioBlob(item.id);
    if (offUrl) URL.revokeObjectURL(offUrl);
    setOffUrl(''); setOffState('none');
    patchItem(item.id, { audio: { ...audioMeta, offline: false } });
  };
  // Switch to a different reciter/voice for this mantra. Works even on a reopened
  // saved item: it loads the candidate list on demand, then advances through it.
  // Every switch is applied (and persisted) automatically.
  const tryAnother = async () => {
    if (!item || audioBusy) return;
    setAudioBusy(true); setStatus(t('searching_recitation'));
    try {
      let list = alts;
      if (!list.length) {
        const r = await fetch(`/api/audio?slug=${encodeURIComponent(item.id)}&name=${encodeURIComponent(item.name || item.title || '')}`);
        const j = await r.json();
        list = (j.ok && j.alternatives) ? j.alternatives : [];
        setAlts(list);
      }
      if (list.length < 2) { setStatus(t('no_other_recitation')); return; }
      // start from the currently-playing item if we can locate it, else from the top
      const curIdx = audioMeta.itemId ? list.findIndex((a) => a.itemId === audioMeta.itemId) : altIdx;
      const next = ((curIdx < 0 ? 0 : curIdx) + 1) % list.length; setAltIdx(next);
      const cand = list[next];
      // Index feeds already carry the resolved url — switch instantly, no search.
      if (cand.url) { applyAudio(cand, { userPicked: true }); }
      else {
        const rr = await fetch(`/api/audio?item=${encodeURIComponent(cand.itemId)}&name=${encodeURIComponent(item.name || item.title || '')}`);
        const jj = await rr.json();
        if (jj.ok && jj.url) applyAudio(jj, { userPicked: true }); else setStatus(t('no_recitation'));
      }
    } catch { setStatus(t('no_recitation')); }
    finally { setAudioBusy(false); }
  };
  // Manual box: accepts a YouTube link (any form) OR a direct .mp3 URL.
  const setManualAudio = (raw) => {
    if (!item) return;
    const v = String(raw || '').trim();
    setUploadUrl(''); setAudioErr(false);
    if (!v) { patchItem(item.id, { audio: { ...audioMeta, url: '', youtube: '', attrib: null } }); return; }
    const yt = parseYouTubeId(v);
    if (yt) { patchItem(item.id, { audio: { ...audioMeta, youtube: yt, url: '', timings: null, method: null, attrib: null } }); setStatus(''); }
    else { patchItem(item.id, { audio: { ...audioMeta, url: v, youtube: '', attrib: null } }); }
  };

  // On opening a mantra: (1) if it has no recitation yet, auto-look one up; else
  // (2) always refresh the list of available recitations so "another voice" knows
  // how many there are, and quietly upgrade a stale AUTO-picked archive track to
  // the index's current preferred feed (so pins / better picks take effect) —
  // without disturbing a user's own pasted/uploaded audio or a voice they picked.
  useEffect(() => {
    if (!item) return;
    setAlts([]); setAltIdx(-1); setShowManual(false); setAudioErr(false); setNoAudioReason('');
    const a = item.audio || {};
    if (!a.url && !a.youtube && !a.autoTried) { findRecitation(); return; }
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch(`/api/audio?slug=${encodeURIComponent(item.id)}&name=${encodeURIComponent(item.name || item.title || '')}`);
        const j = await r.json();
        if (cancelled || !j || !j.ok) return;
        if (Array.isArray(j.alternatives)) setAlts(j.alternatives);
        // Upgrade only a curated/indexed feed over an auto-picked archive track.
        const replaceable = !!a.itemId && !a.youtube && !a.offline && !a.userPicked;
        if (j.indexed && j.url && replaceable && a.url !== j.url) applyAudio(j);
      } catch { /* offline / not deployed yet — leave saved track as-is */ }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item?.id]);

  // Load any on-device (offline) copy for this mantra; play from it when present.
  useEffect(() => {
    let url = '';
    setOffUrl(''); setOffState('none');
    if (item) {
      getAudioBlob(item.id).then((blob) => {
        if (blob) { url = URL.createObjectURL(blob); setOffUrl(url); setOffState('saved'); }
      });
    }
    return () => { if (url) URL.revokeObjectURL(url); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item?.id]);

  if (!page || !item) return (<div className="reader"><div className="reader-top"><span className="title">{t('mybook')}</span><button className="icon-btn" onClick={onClose}>✕</button></div></div>);

  const verseFirstLine = flat.findIndex((l) => l.verseIdx === page.verseIdx);
  const vLines = String(page.verse.text || '').split('\n').map((s) => s.trim()).filter(Boolean);

  return (
    <div className="reader">
      <Rays color="#c98af0" className="rrays" /><Halo className="rhalo" om="#ffe6a0" />
      <div className="reader-top no-print">
        <button className="icon-btn" onClick={onClose} aria-label={t('close')}>✕</button>
        <span className="title">{item.title || item.name}</span>
        <div className="tools">
          <button className={`icon-btn ${readMode === 'large' ? 'on' : ''}`} onClick={() => setReadMode((m) => (m === 'book' ? 'large' : 'book'))} aria-label={t('read_mode')} title={t('read_mode')}><i className={`ti ${readMode === 'large' ? 'ti-book-2' : 'ti-maximize'}`} /></button>
          <button className={`icon-btn ${auto ? 'on' : ''}`} onClick={() => setAuto((a) => !a)} aria-label={t('auto_turn')} title={t('auto_turn')}><i className={`ti ${auto ? 'ti-player-pause' : 'ti-refresh'}`} /></button>
          <button className="icon-btn" onClick={() => setShowToc(true)} aria-label={t('reader_index')}><i className="ti ti-list" /></button>
          <button className="icon-btn" onClick={() => window.print()} aria-label={t('save_pdf')}><i className="ti ti-download" /></button>
          <button className="icon-btn danger" onClick={() => { if (onRemove) onRemove(item.id); onClose(); }} aria-label={t('remove')} title={t('remove')}><i className="ti ti-trash" /></button>
        </div>
      </div>

      <div className="book-stage no-print" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        {readMode === 'book' ? (
          <div className="book">
            <span className="edge edgeL" /><span className="edge edgeR" />
            <div className="pg l">
              <Mandala />
              <div className="pad">
                {prevPage ? (<>
                  <div className="ribbon">{prevPage.verse.section || ''}</div>
                  <div className="cart">{verseLabelCart(prevPage.verse)}</div>
                  <FitVerse baseSize={uniformFs} refreshKey={`prev-${pageIndex}`} style={{ opacity: 0.85 }}>{String(prevPage.verse.text).split('\n').map((l, i) => <div key={i} className="vline">{l.trim()}</div>)}</FitVerse>
                  <div className="pfoot"><span>{prevPage.itemName}</span><span>{pageIndex}</span></div>
                </>) : (
                  <div className="verse"><div style={{ fontFamily: 'var(--deva)', fontSize: 40, color: 'var(--gold-deep)' }}>ॐ</div><div style={{ fontFamily: 'var(--display)', letterSpacing: 2, color: 'var(--maroon)' }}>MANTRA SANGRAHA</div><div style={{ fontFamily: 'var(--deva)', color: 'var(--maroon)' }}>मन्त्र संग्रह</div></div>
                )}
              </div>
            </div>
            <div className={`pg r ${dir === 'next' ? 'turn-next' : 'turn-prev'} ${page.verse.invocation ? 'invocation' : ''}`} key={pageIndex}>
              <Mandala />
              <div className="pad">
                <div className="ribbon">{page.verse.section || item.deity || item.tradition || ''}</div>
                <div className="cart">{verseLabelCart(page.verse)}</div>
                <FitVerse containerRef={boxRef} baseSize={uniformFs} refreshKey={`cur-${pageIndex}`}>{vLines.map((ln, li) => { const g = verseFirstLine + li; const sung = activeLine >= 0 && g === activeLine; return <div key={li} className={`vline ${sung ? 'sung' : ''}`}>{ln}</div>; })}</FitVerse>
                <div className="pfoot"><span>{item.title || item.name}</span><span>{t('page_word')} {pageIndex + 1} · {page.verseLabel}</span></div>
              </div>
            </div>
            <span className="spine" />
          </div>
        ) : (
          <div className="solo">
            <div className={`pg ${dir === 'next' ? 'turn-next' : 'turn-prev'} ${page.verse.invocation ? 'invocation' : ''}`} key={pageIndex}>
              <Mandala />
              <div className="pad">
                <div className="ribbon">{page.verse.section || item.deity || item.tradition || ''}</div>
                <div className="cart">{verseLabelCart(page.verse)}</div>
                <FitVerse containerRef={boxRef} baseSize={uniformFs} refreshKey={`solo-${pageIndex}`}>{vLines.map((ln, li) => { const g = verseFirstLine + li; const sung = activeLine >= 0 && g === activeLine; return <div key={li} className={`vline ${sung ? 'sung' : ''}`}>{ln}</div>; })}</FitVerse>
                <div className="pfoot"><span>{item.title || item.name}</span><span>{t('page_word')} {pageIndex + 1} · {page.verseLabel}</span></div>
              </div>
            </div>
          </div>
        )}

        <div className={`tapzone left ${pageIndex === 0 ? 'disabled' : ''}`} onClick={() => go(-1)}><i className="ti ti-chevron-left chev" /></div>
        <div className={`tapzone right ${pageIndex === pages.length - 1 ? 'disabled' : ''}`} onClick={() => go(1)}><i className="ti ti-chevron-right chev" /></div>
      </div>

      <div className="pager no-print">
        <span className="count">{t('page_word')} {pageIndex + 1} / {pages.length} · {t('tap_hint')}</span>
      </div>

      <div className="audio no-print">
        <div className="abox">
          <div className="arow controls">
            {!hasAudio && (<button className="btn small" onClick={findRecitation} disabled={audioBusy}><i className={`ti ${audioBusy ? 'ti-loader-2 spin' : 'ti-broadcast'}`} /> {t('find_recitation')}</button>)}
            {hasAudio && (<span className="saved-pill"><i className="ti ti-bookmark-filled" /> {t('saved_recitation')}</span>)}
            {isFile && alts.length > 1 && (
              <span className="voice-switch">
                <button className="icon-btn" onClick={tryAnother} disabled={audioBusy} title={t('another_voice')} aria-label={t('another_voice')}><i className={`ti ${audioBusy ? 'ti-loader-2 spin' : 'ti-arrows-shuffle'}`} /></button>
                <span className="voice-count" title={`${alts.length} ${t('recitation')}`}>{(() => { const p = audioMeta.itemId ? alts.findIndex((x) => x.itemId === audioMeta.itemId) : -1; return `${p < 0 ? 1 : p + 1}/${alts.length}`; })()}</span>
              </span>
            )}
            {isFile && !timings && (<button className="btn ghost small" onClick={runSync}><i className="ti ti-sparkles" /> {t('autosync')}</button>)}
            {isFile && timings && (<button className={`icon-btn ${follow ? 'on' : ''}`} onClick={toggleFollow} title={t('follow_toggle')} aria-label={t('follow_toggle')}><i className="ti ti-wave-sine" /></button>)}
            {isFile && timings && (<button className="icon-btn" onClick={runSync} title={t('resync')} aria-label={t('resync')}><i className="ti ti-reload" /></button>)}
            {audioMeta.url && offState === 'saved' && (<button className="icon-btn on" onClick={removeOffline} title={t('offline_saved')} aria-label={t('offline_remove')}><i className="ti ti-cloud-check" /></button>)}
            {audioMeta.url && offState !== 'saved' && (<button className="icon-btn" onClick={downloadOffline} disabled={offState === 'saving'} title={t('download_offline')} aria-label={t('download_offline')}><i className={`ti ${offState === 'saving' ? 'ti-loader-2 spin' : 'ti-cloud-download'}`} /></button>)}
            <button type="button" className="linkish" onClick={() => setShowManual((s) => !s)}>{t('use_own_audio')}</button>
          </div>

          {audioSrc ? (<audio ref={audioRef} controls src={audioSrc} onError={() => setAudioErr(true)} onLoadedMetadata={() => setAudioErr(false)} onTimeUpdate={onTimeUpdate} />)
            : audioMeta.youtube ? (<iframe className="yt" src={`https://www.youtube-nocookie.com/embed/${audioMeta.youtube}`} title="recitation" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />)
            : null}

          {audioErr && (<div className="audio-none"><i className="ti ti-music-off" /> {t('audio_none')}{alts.length > 1 && <button className="icon-btn sm" onClick={tryAnother} disabled={audioBusy} title={t('another_voice')} style={{ marginLeft: 8 }}><i className="ti ti-arrows-shuffle" /></button>}</div>)}
          {!hasAudio && !audioBusy && noAudioReason === 'unavailable' && (<div className="audio-none"><i className="ti ti-wifi-off" /> {t('audio_unavailable')}<button className="icon-btn sm" onClick={findRecitation} title={t('find_recitation')} style={{ marginLeft: 8 }}><i className="ti ti-refresh" /></button></div>)}
          {!hasAudio && !audioBusy && (noAudioReason === 'none' || (noAudioReason === '' && audioMeta.autoTried)) && (<div className="audio-none"><i className="ti ti-music-off" /> {t('audio_none')}</div>)}
          {audioSrc && !audioErr && !offUrl && audioMeta.attrib?.url && (<a className="src-link" href={audioMeta.attrib.url} target="_blank" rel="noreferrer">{t('recitation')} · Internet Archive</a>)}

          {isFile && timings && timings.length > 0 && follow && (
            <div className="arow sync-nudge">
              <span className="lbl"><i className="ti ti-adjustments-alt" /> {t('fix_sync')}</span>
              <button className="icon-btn" onClick={() => nudgeSync(-1)} aria-label="highlight earlier" title={t('sync_earlier')}>◀</button>
              <span className="shift-val">{lineShift > 0 ? `+${lineShift}` : lineShift}</span>
              <button className="icon-btn" onClick={() => nudgeSync(1)} aria-label="highlight later" title={t('sync_later')}>▶</button>
              <span className="hint-inline">{t('sync_hint')}</span>
            </div>
          )}

          {showManual && (
            <div className="arow manual">
              <input type="text" placeholder="…paste a YouTube link / .mp3 URL" defaultValue="" onBlur={(e) => setManualAudio(e.target.value)} />
              <button className="btn ghost small" onClick={() => uploadRef.current?.click()}><i className="ti ti-microphone" /> {t('upload')}</button>
              <input ref={uploadRef} type="file" accept="audio/*" hidden onChange={onUpload} />
            </div>
          )}

          <div className="sync-status">{status}</div>
        </div>
      </div>

      {showToc && (
        <div className="toc-drawer no-print" onClick={() => setShowToc(false)}>
          <div className="toc-panel" onClick={(e) => e.stopPropagation()}>
            <div className="toc-h">॥ अनुक्रमणिका ॥ — {t('reader_toc_title')}</div>
            {toc.map((g) => (
              <div key={g.section.id}>
                <div className="toc-cat">{SEC_KEY[g.section.id] ? t(SEC_KEY[g.section.id]) : g.section.dev}</div>
                {g.entries.map((en) => (
                  <div key={en.item.id} className={`toc-row ${en.item.id === item.id ? 'active' : ''}`} onClick={() => { setShowToc(false); goTo(en.startPage, en.startPage < pageIndex); }}>
                    <span className="num">{en.no}.</span><span>{en.item.title || en.item.name}</span><span className="dots" /><span className="pg-no">{en.startPage + 1}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      <PrintBook item={item} />
    </div>
  );
}

// Measures the hardest-to-fit verses of a mantra and returns ONE font size that
// fits them all — so every page of the same mantra renders at a consistent size
// (no more some-pages-bigger), while still never clipping.
function measureUniform(box, verses) {
  if (!box || !verses || !verses.length) return 20;
  const w = box.clientWidth, h = box.clientHeight;
  if (!w || !h) return 20;
  const m = document.createElement('div');
  m.style.cssText = `position:fixed;left:-99999px;top:0;visibility:hidden;box-sizing:border-box;width:${w}px;font-family:var(--deva);line-height:1.85;text-align:center;`;
  document.body.appendChild(m);
  const score = (v) => (String(v.text || '').split('\n').length * 60) + String(v.text || '').length;
  const cand = verses.slice().sort((a, b) => score(b) - score(a)).slice(0, 5);
  let uni = 24;
  for (const v of cand) {
    const lines = String(v.text || '').split('\n').map((s) => s.trim()).filter(Boolean);
    m.innerHTML = lines.map((l) => `<div style="padding:2px 8px">${l.replace(/[&<>]/g, ' ')}</div>`).join('');
    let lo = 11, hi = 24, best = 11;
    while (lo <= hi) { const mid = (lo + hi) >> 1; m.style.fontSize = mid + 'px'; if (m.scrollHeight <= h) { best = mid; lo = mid + 1; } else hi = mid - 1; }
    if (best < uni) uni = best;
  }
  document.body.removeChild(m);
  return uni;
}

// Renders a verse at `baseSize` (the per-mantra uniform size); only shrinks/
// scrolls further as a safety net if an outlier still overflows.
function FitVerse({ children, refreshKey, className = '', style, containerRef, baseSize }) {
  const internal = useRef(null);
  const setRef = (el) => { internal.current = el; if (containerRef) containerRef.current = el; };
  useEffect(() => {
    const el = internal.current; if (!el) return;
    const fit = () => {
      el.classList.remove('scrolling');
      let size = baseSize || 22;
      el.style.setProperty('--vfs', size + 'px');
      let guard = 0;
      while (el.scrollHeight > el.clientHeight + 1 && size > 11 && guard < 80) { size -= 1; el.style.setProperty('--vfs', size + 'px'); guard += 1; }
      if (el.scrollHeight > el.clientHeight + 1) el.classList.add('scrolling');
    };
    fit();
    let ro;
    if (typeof ResizeObserver !== 'undefined') { ro = new ResizeObserver(fit); ro.observe(el); }
    return () => { if (ro) ro.disconnect(); };
  }, [refreshKey, baseSize]);
  return <div ref={setRef} className={`verse ${className}`} style={style}>{children}</div>;
}

function Mandala() {
  return (
    <svg className="mandala" viewBox="0 0 100 100" aria-hidden="true"><g fill="none" stroke="#7a1f12" strokeWidth="1">
      <circle cx="50" cy="50" r="44" /><circle cx="50" cy="50" r="30" /><circle cx="50" cy="50" r="16" />
      {Array.from({ length: 12 }).map((_, i) => <ellipse key={i} cx="50" cy="28" rx="5" ry="12" transform={`rotate(${i * 30} 50 50)`} />)}
    </g></svg>
  );
}
function verseLabelCart(v) { return v.invocation ? 'ध्यानम्' : v.colophon ? 'फलश्रुति' : `॥ ${v.n} ॥`; }

function buildPages(book) {
  const secs = book.sections.length ? book.sections : DEFAULT_SECTIONS;
  const pages = []; const firstPageOf = {}; const toc = [];
  for (const s of secs) {
    const items = book.items.filter((it) => it.sectionId === s.id); if (!items.length) continue;
    const entries = [];
    items.forEach((it, i) => {
      firstPageOf[it.id] = pages.length; entries.push({ item: it, no: i + 1, startPage: pages.length });
      (it.verses || []).forEach((verse, verseIdx) => pages.push({ itemId: it.id, itemName: it.title || it.name, deity: it.deity, tradition: it.tradition, verse, verseIdx, verseLabel: verse.invocation ? 'ध्यानम्' : verse.colophon ? 'फलश्रुति' : `${verse.n}` }));
    });
    toc.push({ section: s, entries });
  }
  if (!pages.length && book.items.length) {
    book.items.forEach((it) => { firstPageOf[it.id] = pages.length; (it.verses || []).forEach((verse, verseIdx) => pages.push({ itemId: it.id, itemName: it.title || it.name, deity: it.deity, verse, verseIdx, verseLabel: `${verse.n}` })); });
    toc.push({ section: { id: 'all', dev: 'सङ्ग्रह', en: 'All' }, entries: book.items.map((it, i) => ({ item: it, no: i + 1, startPage: firstPageOf[it.id] })) });
  }
  return { pages, toc, firstPageOf };
}

function PrintBook({ item }) {
  return (
    <div className="print-book">
      <h1 style={{ fontFamily: 'var(--deva)' }}>{item.name}</h1>
      <p style={{ color: '#444', fontSize: 13 }}>{[item.deity, item.tradition].filter(Boolean).join(' · ')}<br />Source: {item.source} — {item.sourceUrl}</p>
      {(item.verses || []).map((v, i) => (
        <div key={i} style={{ marginBottom: 14, breakInside: 'avoid' }}>
          {v.section ? <div style={{ fontFamily: 'var(--deva)', color: '#7a2617', fontSize: 15 }}>{v.section}</div> : null}
          <div style={{ fontFamily: 'var(--deva)', fontSize: 19, lineHeight: 2, whiteSpace: 'pre-line' }}>{v.text}</div>
          <div style={{ color: '#999', fontSize: 12 }}>{verseLabelCart(v)}</div>
        </div>
      ))}
    </div>
  );
}

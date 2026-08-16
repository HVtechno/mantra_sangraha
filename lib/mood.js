// lib/mood.js
// Match a person's free-text mood to real mantras.
//
// SAFE use of AI: the model only CHOOSES from our catalog (by slug) and writes a
// short reason. The sacred text itself is always fetched from the source, never
// generated. If there's no API key (or the call fails), we fall back to a
// keyword matcher so the feature still works offline.

const aliases = require('./aliases');

function catalogForPrompt() {
  return aliases.CATALOG
    .map((r) => `${r.slug} — ${r.name} — ${r.deity || ''} — ${r.tradition || ''}`)
    .join('\n');
}

// ---- keyword fallback -----------------------------------------------------

const MOOD_HINTS = {
  anger: ['shiva', 'shanti', 'nirvana'], calm: ['shiva', 'shanti', 'guru'],
  peace: ['guru', 'lakshmi', 'shiva'], fear: ['durga', 'narasimha', 'shiva'],
  anxious: ['shiva', 'vishnu', 'narayana'], anxiety: ['shiva', 'vishnu'],
  worry: ['shiva', 'vishnu'], overwhelm: ['shiva', 'vishnu', 'atman'],
  sleep: ['shiva', 'narayana', 'vishnu'], insomnia: ['shiva', 'vishnu'], rest: ['vishnu', 'shiva'],
  grief: ['vishnu', 'atman', 'guru'], sad: ['vishnu', 'atman'], loss: ['atman', 'vishnu', 'guru'], lonely: ['guru', 'vishnu'],
  focus: ['saraswati', 'medha', 'ganesha'], study: ['saraswati', 'medha', 'ganesha'], exam: ['saraswati', 'ganesha'], concentrate: ['saraswati', 'medha'],
  courage: ['durga', 'ganesha', 'devi'], strength: ['durga', 'shiva'], confidence: ['durga', 'ganesha'], brave: ['durga'],
  gratitude: ['guru', 'lakshmi'], grateful: ['guru', 'lakshmi'], thankful: ['guru'],
  devotion: ['devi', 'vishnu'], love: ['devi', 'vishnu'], longing: ['vishnu', 'devi'],
  money: ['lakshmi'], prosperity: ['lakshmi'], wealth: ['lakshmi'], abundance: ['lakshmi'], success: ['ganesha', 'lakshmi'],
  protection: ['shiva', 'durga', 'narasimha'], safe: ['durga', 'shiva'], health: ['shiva'], healing: ['shiva'], sick: ['shiva'],
  obstacle: ['ganesha'], start: ['ganesha'], begin: ['ganesha'], new: ['ganesha'],
  wisdom: ['shiva', 'atman'], clarity: ['saraswati', 'atman'], confused: ['saraswati', 'atman'], letting: ['atman', 'vishnu'],
};

function matchMood(query, limit = 3) {
  const q = String(query || '').toLowerCase();
  const words = q.split(/[^a-z]+/).filter(Boolean);
  const targets = new Set();
  for (const w of words) {
    for (const [k, arr] of Object.entries(MOOD_HINTS)) {
      if (w === k || w.includes(k) || k.includes(w)) arr.forEach((t) => targets.add(t));
    }
  }
  const scored = aliases.CATALOG.map((r) => {
    const hay = `${r.deity || ''} ${r.tradition || ''} ${r.slug} ${(r.aliases || []).join(' ')}`.toLowerCase();
    let s = 0;
    for (const t of targets) if (hay.includes(t)) s += 2;
    for (const w of words) if (w.length > 3 && hay.includes(w)) s += 1;
    return { r, s };
  }).filter((x) => x.s > 0).sort((a, b) => b.s - a.s);

  const chosen = (scored.length ? scored.map((x) => x.r) : aliases.CATALOG).slice(0, limit);
  return chosen.map((r) => ({
    slug: r.slug, name: r.name, deity: r.deity || null,
    reason: `traditionally turned to for ${r.deity || 'the divine'} — a steadying chant.`,
  }));
}

// ---- OpenAI matcher -------------------------------------------------------

async function aiMatchMood(query, { key, model }) {
  const sys =
    'You are matching a person\'s mood to Hindu mantras/stotras for a calming chanting practice. ' +
    'Choose ONLY from the provided catalog, by exact slug. Return the 2-4 BEST and most VARIED matches — genuinely fit the mood and do NOT default to the same famous stotras every time. ' +
    'Match the deity to the need: calm/anger → Shiva or Shanti; fear/protection → Durga, Narasimha, or Mahamrityunjaya; grief/letting go → Vishnu or Atman (Bhaja Govindam, Nirvana Shatkam); focus/study → Saraswati, Medha, Ganesha; courage/strength → Durga, Ganesha; prosperity → Lakshmi; obstacles/new beginnings → Ganesha; devotion/love → Devi or Vishnu; wisdom/clarity → Dakshinamurthy or Atman. ' +
    'Give each a warm reason under 12 words. This is a contemplative practice, not medical treatment — never claim to cure or diagnose. ' +
    'Respond ONLY as JSON: {"matches":[{"slug":"<slug>","reason":"<reason>"}]}';
  const usr = `Mood: ${query}\n\nCatalog (slug — name — deity — tradition):\n${catalogForPrompt()}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: model || 'gpt-4o-mini',
        temperature: 0.6,
        response_format: { type: 'json_object' },
        messages: [{ role: 'system', content: sys }, { role: 'user', content: usr }],
      }),
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`openai_${res.status}`);
    const j = await res.json();
    const parsed = JSON.parse(j.choices?.[0]?.message?.content || '{}');
    const bySlug = Object.fromEntries(aliases.CATALOG.map((r) => [r.slug, r]));
    const matches = (parsed.matches || [])
      .map((m) => {
        const r = bySlug[m.slug];
        if (!r) return null; // drop anything not in our catalog
        return { slug: r.slug, name: r.name, deity: r.deity || null, reason: String(m.reason || '').slice(0, 140) };
      })
      .filter(Boolean);
    return matches.slice(0, 4);
  } finally {
    clearTimeout(timer);
  }
}

async function moodSearch(query) {
  const q = String(query || '').trim();
  if (!q) return { ok: false, error: 'empty' };
  const key = process.env.OPENAI_API_KEY;
  if (key) {
    try {
      const matches = await aiMatchMood(q, { key, model: process.env.OPENAI_MODEL });
      if (matches.length) return { ok: true, ai: true, matches };
    } catch (e) {
      // fall through to keyword matching
    }
  }
  return { ok: true, ai: false, matches: matchMood(q) };
}

module.exports = { moodSearch, matchMood };

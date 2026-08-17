// lib/aliases.js
// Normalisation table: maps the many spellings people type into a canonical
// stotra record with the source slug. Slugs below are verified against
// vignanam.org's /devanagari/<slug>.html pages.
//
// Each entry: { slug, name, tradition, deity, aliases: [] }
// `aliases` are matched case-insensitively after light normalisation.

const CATALOG = [
  {
    slug: 'soundarya-lahari',
    name: 'Soundarya Lahari',
    tradition: 'Adi Shankaracharya',
    deity: 'Devi',
    aliases: ['soundarya lahari', 'saundarya lahari', 'soundaryalahari', 'soundarya', 'saundaryalahari', 'सौन्दर्य लहरी'],
  },
  {
    slug: 'shivananda-lahari',
    name: 'Shivananda Lahari',
    tradition: 'Adi Shankaracharya',
    deity: 'Shiva',
    aliases: ['shivananda lahari', 'sivananda lahari', 'shivanandalahari'],
  },
  {
    slug: 'ananda-lahari',
    name: 'Ananda Lahari',
    tradition: 'Adi Shankaracharya',
    deity: 'Devi',
    aliases: ['ananda lahari', 'anandalahari'],
  },
  {
    slug: 'shiva-panchakshari-stotram',
    name: 'Shiva Panchakshari Stotram',
    tradition: 'Adi Shankaracharya',
    deity: 'Shiva',
    aliases: ['shiva panchakshari', 'panchakshari stotram', 'panchakshara stotram', 'nagendra haraya'],
  },
  {
    slug: 'nirvana-shatkam',
    name: 'Nirvana Shatkam (Atma Shatkam)',
    tradition: 'Adi Shankaracharya',
    deity: 'Atman',
    aliases: ['nirvana shatkam', 'atma shatkam', 'nirvanashatkam', 'mano buddhi ahankara', 'chidananda rupah shivoham'],
  },
  {
    slug: 'bhaja-govindam-moha-mudagaram',
    name: 'Bhaja Govindam (Moha Mudgaram)',
    tradition: 'Adi Shankaracharya',
    deity: 'Vishnu',
    aliases: ['bhaja govindam', 'moha mudgaram', 'bhajagovindam', 'bhaja govindam bhaja govindam'],
  },
  {
    slug: 'dakshina-murthy-stotram',
    name: 'Dakshinamurthy Stotram',
    tradition: 'Adi Shankaracharya',
    deity: 'Shiva',
    aliases: ['dakshinamurthy stotram', 'dakshina murthy', 'dakshinamurti stotram', 'dakshinamurthi'],
  },
  {
    slug: 'kanakadhara-stotram',
    name: 'Kanakadhara Stotram',
    tradition: 'Adi Shankaracharya',
    deity: 'Lakshmi',
    aliases: ['kanakadhara stotram', 'kanakadhara', 'angam hare'],
  },
  {
    slug: 'sree-maha-ganesha-pancharatnam',
    name: 'Maha Ganesha Pancharatnam',
    tradition: 'Adi Shankaracharya',
    deity: 'Ganesha',
    aliases: ['ganesha pancharatnam', 'maha ganesha pancharatnam', 'mahaganesha pancharatnam', 'mudakaratha modakam'],
  },
  {
    slug: 'totakashtakam',
    name: 'Totakashtakam',
    tradition: 'Totakacharya',
    deity: 'Guru / Shankara',
    aliases: ['totakashtakam', 'totaka ashtakam', 'viditakhila'],
  },
  {
    slug: 'gurvashtakam',
    name: 'Guru Ashtakam (Gurvashtakam)',
    tradition: 'Adi Shankaracharya',
    deity: 'Guru',
    aliases: ['gurvashtakam', 'guru ashtakam', 'guru vandana', 'sharira surupa'],
  },
  {
    slug: 'guru-paduka-stotram',
    name: 'Guru Paduka Stotram',
    tradition: 'Adi Shankaracharya',
    deity: 'Guru',
    aliases: ['guru paduka stotram', 'guru paduka', 'anantha samsara'],
  },
  {
    slug: 'shiva-manasa-puja',
    name: 'Shiva Manasa Puja',
    tradition: 'Adi Shankaracharya',
    deity: 'Shiva',
    aliases: ['shiva manasa puja', 'ratnaih kalpita'],
  },
  {
    slug: 'lakshmi-nrusimha-karavalamba-stotram',
    name: 'Lakshmi Nrusimha Karavalamba Stotram',
    tradition: 'Adi Shankaracharya',
    deity: 'Narasimha',
    aliases: ['lakshmi nrusimha karavalamba', 'karavalamba stotram', 'nrusimha karavalamba', 'sri lakshmi narasimha'],
  },
  {
    slug: 'bhavani-ashtakam',
    name: 'Bhavani Ashtakam',
    tradition: 'Adi Shankaracharya',
    deity: 'Devi',
    aliases: ['bhavani ashtakam', 'na tato na mata', 'gatis tvam gatis tvam'],
  },
  {
    slug: 'lalitha-pancha-ratnam',
    name: 'Lalita Pancharatnam',
    tradition: 'Adi Shankaracharya',
    deity: 'Devi',
    aliases: ['lalita pancharatnam', 'lalitha pancha ratnam', 'pratah smarami lalita'],
  },
  {
    slug: 'sree-lalitha-sahasra-nama-stotram',
    name: 'Lalita Sahasranama Stotram',
    tradition: 'Brahmanda Purana',
    deity: 'Devi',
    aliases: ['lalita sahasranama', 'lalitha sahasranama', 'lalita sahasranamam', 'sri mata sri maharajni'],
  },
  {
    slug: 'sri-mahishasura-mardini-stotram-ayigiri-nandini',
    name: 'Mahishasura Mardini Stotram (Aigiri Nandini)',
    tradition: 'Adi Shankaracharya',
    deity: 'Devi',
    aliases: ['mahishasura mardini', 'aigiri nandini', 'ayigiri nandini', 'mahishasuramardini'],
  },
  {
    slug: 'sri-suktam',
    name: 'Sri Suktam',
    tradition: 'Rig Veda (khila)',
    deity: 'Lakshmi',
    aliases: ['sri suktam', 'shri suktam', 'hiranyavarnam'],
  },
  {
    slug: 'durga-suktam',
    name: 'Durga Suktam',
    tradition: 'Taittiriya Aranyaka',
    deity: 'Durga',
    aliases: ['durga suktam', 'jatavedase sunavama'],
  },
  {
    slug: 'maha-lakshmi-ashtakam',
    name: 'Maha Lakshmi Ashtakam',
    tradition: 'Padma Purana',
    deity: 'Lakshmi',
    aliases: ['maha lakshmi ashtakam', 'mahalakshmi ashtakam', 'namastestu mahamaye'],
  },
  {
    slug: 'uma-maheswara-stotram',
    name: 'Uma Maheswara Stotram',
    tradition: 'Adi Shankaracharya',
    deity: 'Shiva-Parvati',
    aliases: ['uma maheswara stotram', 'uma maheshwara', 'namah shivabhyam'],
  },
  {
    slug: 'ardha-naareeswara-ashtakam',
    name: 'Ardhanarishwara Ashtakam',
    tradition: 'Adi Shankaracharya',
    deity: 'Ardhanarishwara',
    aliases: ['ardhanarishwara ashtakam', 'ardha nareeswara', 'champeya gaurardha'],
  },
  {
    slug: 'jagannatha-ashtakam',
    name: 'Jagannatha Ashtakam',
    tradition: 'Adi Shankaracharya',
    deity: 'Jagannatha',
    aliases: ['jagannatha ashtakam', 'jagannathashtakam', 'kadachit kalindi'],
  },
  {
    slug: 'saraswati-stotram',
    name: 'Saraswati Stotram',
    tradition: 'Traditional',
    deity: 'Saraswati',
    aliases: ['saraswati stotram', 'ya kundendu', 'yaa kundendu tushaara'],
  },

  // ---- Vedic (file under Veda) ----
  {
    slug: 'sri-rudram-namakam', name: 'Sri Rudram Namakam', tradition: 'Krishna Yajurveda (Taittiriya Samhita)', deity: 'Shiva',
    aliases: ['sri rudram namakam', 'sri rudram', 'rudram', 'rudram namakam', 'sri rudra namakam', 'namakam', 'rudra prashna namakam', 'namo bhagavate rudraya'],
  },
  {
    slug: 'sri-rudram-chamakam', name: 'Sri Rudram Chamakam', tradition: 'Krishna Yajurveda (Taittiriya Samhita)', deity: 'Shiva',
    aliases: ['sri rudram chamakam', 'chamakam', 'rudram chamakam', 'sri rudra chamakam', 'chamaka prashna', 'agnavishnu'],
  },
  {
    slug: 'sri-rudram-laghunyasam', name: 'Sri Rudram Laghunyasam', tradition: 'Krishna Yajurveda', deity: 'Shiva',
    aliases: ['sri rudram laghunyasam', 'laghunyasam', 'rudram laghunyasa', 'laghu nyasam'],
  },
  {
    slug: 'purusha-suktam', name: 'Purusha Suktam', tradition: 'Rig / Yajur Veda', deity: 'Vishnu (Purusha)',
    aliases: ['purusha suktam', 'purusha sooktam', 'purusha suktham', 'sahasra sirsha purusha'],
  },
  {
    slug: 'narayana-suktam', name: 'Narayana Suktam', tradition: 'Krishna Yajurveda', deity: 'Vishnu',
    aliases: ['narayana suktam', 'narayana sooktam'],
  },
  {
    slug: 'sri-suktam', name: 'Sri Suktam', tradition: 'Rig Veda (khila)', deity: 'Lakshmi',
    aliases: ['sri suktam', 'shri suktam', 'hiranyavarnam', 'lakshmi suktam'],
  },
  {
    slug: 'mantra-pushpam', name: 'Mantra Pushpam', tradition: 'Taittiriya Aranyaka', deity: 'Veda',
    aliases: ['mantra pushpam', 'mantrapushpam', 'yo apam pushpam'],
  },
  {
    slug: 'medha-suktam', name: 'Medha Suktam', tradition: 'Taittiriya Aranyaka', deity: 'Saraswati / Medha',
    aliases: ['medha suktam', 'medha sooktam'],
  },
  {
    slug: 'manyu-suktam', name: 'Manyu Suktam', tradition: 'Rig Veda', deity: 'Manyu',
    aliases: ['manyu suktam', 'manyu sooktam'],
  },
  {
    slug: 'sri-ganesha-ganapati-suktam', name: 'Ganapati Suktam', tradition: 'Rig Veda', deity: 'Ganesha',
    aliases: ['ganapati suktam', 'ganesha suktam', 'gananam tva ganapatim'],
  },
  {
    slug: 'gayatri-mantram-ghanapatham', name: 'Gayatri Mantram (Ghanapatham)', tradition: 'Veda', deity: 'Gayatri',
    aliases: ['gayatri', 'gayatri mantra', 'gayatri mantram', 'gayatri ghanapatham', 'om bhur bhuvah'],
  },

  // ---- Shiva stotras ----
  {
    slug: 'lingashtakam', name: 'Lingashtakam', tradition: 'Traditional', deity: 'Shiva',
    aliases: ['lingashtakam', 'linga ashtakam', 'brahma murari sura'],
  },
  {
    slug: 'shiva-tandava-stotram', name: 'Shiva Tandava Stotram', tradition: 'Ravana', deity: 'Shiva',
    aliases: ['shiva tandava stotram', 'shiva tandava', 'jatatavigalajjala', 'jata kata aha'],
  },
  {
    slug: 'shiva-mahimna-stotram', name: 'Shiva Mahimna Stotram', tradition: 'Pushpadanta', deity: 'Shiva',
    aliases: ['shiva mahimna stotram', 'shiva mahimna', 'mahimna stotram', 'mahimnah param'],
  },
  {
    slug: 'bilvaashtakam', name: 'Bilvashtakam', tradition: 'Traditional', deity: 'Shiva',
    aliases: ['bilvashtakam', 'bilva ashtakam', 'tridalam trigunakaram'],
  },
  {
    slug: 'rudrashtakam', name: 'Rudrashtakam', tradition: 'Tulsidas', deity: 'Shiva',
    aliases: ['rudrashtakam', 'rudra ashtakam', 'namami shamishana', 'namameeshameeshana'],
  },
  {
    slug: 'kalabhairava-ashtakam', name: 'Kalabhairava Ashtakam', tradition: 'Adi Shankaracharya', deity: 'Bhairava',
    aliases: ['kalabhairava ashtakam', 'kala bhairava ashtakam', 'devaraja sevyamana'],
  },
  {
    slug: 'maha-mrutyunjaya-stotram-rudram-pasupatim', name: 'Mahamrityunjaya Stotram', tradition: 'Traditional', deity: 'Shiva',
    aliases: ['mahamrityunjaya stotram', 'maha mrityunjaya', 'mrityunjaya stotram', 'rudram pashupatim'],
  },
  {
    slug: 'shiva-shadakshari-stotram', name: 'Shiva Shadakshari Stotram', tradition: 'Adi Shankaracharya', deity: 'Shiva',
    aliases: ['shiva shadakshari', 'shadakshari stotram', 'omkaram bindu samyuktam'],
  },
  {
    slug: 'dwadasa-jyotirlinga-stotram', name: 'Dwadasa Jyotirlinga Stotram', tradition: 'Adi Shankaracharya', deity: 'Shiva',
    aliases: ['dwadasa jyotirlinga', 'jyotirlinga stotram', 'saurashtre somanatham'],
  },
  {
    slug: 'shiva-sahasra-nama-stotram', name: 'Shiva Sahasranama Stotram', tradition: 'Mahabharata', deity: 'Shiva',
    aliases: ['shiva sahasranama', 'shiva sahasra nama', 'shiva sahasranamam'],
  },

  // ---- Nitya karma / daily ritual (file under Veda) ----
  {
    slug: 'nitya-sandhya-vandanam', name: 'Nitya Sandhya Vandanam', tradition: 'Krishna Yajurveda (nitya karma)', deity: 'Gayatri / Surya',
    aliases: [
      'sandhyavandanam', 'sandhya vandanam', 'sandhyavandhanam', 'sandhya vandhanam',
      'sandhyavandana', 'sandhya vandana', 'nitya sandhya vandanam', 'nitya sandhyavandanam',
      'sandhyavandanam yajurveda', 'yajur sandhya vandanam', 'yajurveda sandhya vandanam',
    ],
  },
  {
    slug: 'rigveda-sandhya-vandanam', name: 'Rigveda Sandhya Vandanam', tradition: 'Rig Veda (nitya karma)', deity: 'Gayatri / Surya',
    aliases: ['rigveda sandhya vandanam', 'rig veda sandhya vandanam', 'rigveda sandhyavandanam', 'rk sandhya vandanam'],
  },

  // ---- Tamil / regional devotional (fetched from Wikisource, not vignanam) ----
  // Its source is the wikisource TITLE_MAP (slug 'sivapuranam' -> ta.wikisource);
  // this catalog entry only makes it DISCOVERABLE (autocomplete + a fixed slug).
  {
    slug: 'sivapuranam', name: 'Sivapuranam (Thiruvāsagam)', tradition: 'Manikkavacakar', deity: 'Shiva',
    aliases: ['sivapuranam', 'siva puranam', 'sivapuraanam', 'sivapuraNam', 'thiruvasagam sivapuranam', 'thiruvasakam sivapuranam', 'சிவ புராணம்', 'சிவபுராணம்'],
  },
];

// --- normalisation & lookup ------------------------------------------------

function normalize(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ') // drop punctuation
    .replace(/\s+/g, ' ')
    .trim();
}

// Build an index once.
const INDEX = new Map();
for (const rec of CATALOG) {
  const keys = new Set([rec.name, rec.slug.replace(/-/g, ' '), ...(rec.aliases || [])]);
  for (const k of keys) INDEX.set(normalize(k), rec);
}

/** Slugify an arbitrary query as a last-resort source path guess. */
function slugify(s) {
  return normalize(s).replace(/\s+/g, '-');
}

/** Exact/alias resolution. Returns a record or null. */
function resolve(query) {
  const n = normalize(query);
  if (!n) return null;
  if (INDEX.has(n)) return INDEX.get(n);
  // token-subset match: every catalog alias token appears in the query or v.v.
  for (const [key, rec] of INDEX) {
    if (key.length < 4) continue;
    if (n.includes(key) || key.includes(n)) return rec;
  }
  return null;
}

/** Fuzzy suggestions for the search box. */
function suggest(query, limit = 8) {
  const n = normalize(query);
  if (!n) return CATALOG.slice(0, limit);
  const toks = n.split(' ').filter(Boolean);
  const scored = CATALOG.map((rec) => {
    const hay = normalize([rec.name, rec.deity, rec.tradition, ...(rec.aliases || [])].join(' '));
    let score = 0;
    for (const t of toks) if (hay.includes(t)) score += t.length;
    if (hay.startsWith(n)) score += 5;
    return { rec, score };
  });
  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((s) => s.rec);
}

module.exports = { CATALOG, normalize, slugify, resolve, suggest };

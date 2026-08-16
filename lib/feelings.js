// lib/feelings.js
// Curated "By feeling" (bhava) map — a SECONDARY doorway into the same catalog.
// Each recommendation's `q` is a query that resolves through lib/aliases.js, so
// tapping it runs the normal fetch pipeline.

export const FEELINGS = [
  {
    key: 'anger', dev: 'क्रोध', en: 'anger', dot: '#c0392b',
    intent: 'cool a heated mind with slow, steadying chants',
    picks: [
      { name: 'शिव पञ्चाक्षरी स्तोत्रम्', q: 'shiva panchakshari stotram', deity: 'Shiva', note: 'ॐ नमः शिवाय — a slow anchor for the breath.' },
      { name: 'शिव मानस पूजा', q: 'shiva manasa puja', deity: 'Shiva', note: 'Offer the anger inward — worship done in the mind.' },
      { name: 'निर्वाण षट्कम्', q: 'nirvana shatkam', deity: 'Atman', note: '“I am not the anger, not the mind” — loosens the grip.' },
    ],
  },
  {
    key: 'fear', dev: 'भय', en: 'fear · anxiety', dot: '#3a4e86',
    intent: 'chants of protection and courage',
    picks: [
      { name: 'आइगिरि नन्दिनी', q: 'aigiri nandini', deity: 'Durga', note: 'The fierce Mother — a rising, fortifying rhythm.' },
      { name: 'लक्ष्मी नृसिंह करावलम्ब', q: 'lakshmi nrusimha karavalamba', deity: 'Narasimha', note: '“Give me the support of your hand” — refuge.' },
      { name: 'शिव पञ्चाक्षरी स्तोत्रम्', q: 'shiva panchakshari stotram', deity: 'Shiva', note: 'Grounding syllables to steady the breath.' },
    ],
  },
  {
    key: 'grief', dev: 'शोक', en: 'grief', dot: '#5b6b7a',
    intent: 'chants of letting go and perspective',
    picks: [
      { name: 'भज गोविन्दम्', q: 'bhaja govindam', deity: 'Vishnu', note: 'On the fleeting nature of things — a gentle release.' },
      { name: 'निर्वाण षट्कम्', q: 'nirvana shatkam', deity: 'Atman', note: 'A return to what does not come and go.' },
      { name: 'गुरु पादुका स्तोत्रम्', q: 'guru paduka stotram', deity: 'Guru', note: 'Rest the grief at the teacher’s feet.' },
    ],
  },
  {
    key: 'restless', dev: 'चञ्चल', en: 'restless', dot: '#1e7a6e',
    intent: 'chants for clarity and focus',
    picks: [
      { name: 'सरस्वती स्तोत्रम्', q: 'saraswati stotram', deity: 'Saraswati', note: 'या कुन्देन्दु — invoking clear, luminous thought.' },
      { name: 'ललिता पञ्चरत्नम्', q: 'lalita pancharatnam', deity: 'Devi', note: 'Five jewels — a short, collecting recitation.' },
      { name: 'महागणेश पञ्चरत्नम्', q: 'maha ganesha pancharatnam', deity: 'Ganesha', note: 'Clears the clutter before beginning.' },
    ],
  },
  {
    key: 'courage', dev: 'साहस', en: 'courage', dot: '#e08a1e',
    intent: 'chants that steady the spine',
    picks: [
      { name: 'महिषासुरमर्दिनी', q: 'mahishasura mardini', deity: 'Durga', note: 'The victory hymn — a rhythm that lifts you up.' },
      { name: 'महागणेश पञ्चरत्नम्', q: 'maha ganesha pancharatnam', deity: 'Ganesha', note: 'Remover of obstacles before a hard step.' },
      { name: 'भवानी अष्टकम्', q: 'bhavani ashtakam', deity: 'Devi', note: '“You alone are my refuge” — steadying.' },
    ],
  },
  {
    key: 'peace', dev: 'शान्ति', en: 'peace · gratitude', dot: '#4a8a4a',
    intent: 'chants of thanksgiving and calm',
    picks: [
      { name: 'गुर्वष्टकम्', q: 'gurvashtakam', deity: 'Guru', note: 'Eight verses of gratitude to the teacher.' },
      { name: 'कनकधारा स्तोत्रम्', q: 'kanakadhara stotram', deity: 'Lakshmi', note: 'A stream of grace — abundance and ease.' },
      { name: 'सौन्दर्य लहरी', q: 'soundarya lahari', deity: 'Devi', note: 'Waves of beauty — a serene, flowing reading.' },
    ],
  },
];

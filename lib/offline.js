// lib/offline.js
// Tiny IndexedDB blob store for offline recitations. When the user taps "Save for
// offline", we download the mp3 and keep the actual bytes here (keyed by the book
// item id), then play from the local copy — so it works with no internet AND is
// immune to archive.org search outages. Client-only (guards against SSR).

const DB_NAME = 'mantra-sangraha-offline';
const STORE = 'audio';

function openDB() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') { reject(new Error('no-indexeddb')); return; }
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveAudioBlob(key, blob) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(blob, key);
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
}

export async function getAudioBlob(key) {
  try {
    const db = await openDB();
    return await new Promise((resolve) => {
      const tx = db.transaction(STORE, 'readonly');
      const g = tx.objectStore(STORE).get(key);
      g.onsuccess = () => resolve(g.result || null);
      g.onerror = () => resolve(null);
    });
  } catch { return null; }
}

export async function removeAudioBlob(key) {
  try {
    const db = await openDB();
    return await new Promise((resolve) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).delete(key);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    });
  } catch { return false; }
}

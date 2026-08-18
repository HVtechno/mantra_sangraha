// Mantra Sangraha service worker — makes the app installable (PWA) and gives a
// basic offline shell. Kept deliberately conservative: network-first, and we
// only cache the app shell + static assets (never API responses or the external
// recitation/font requests), so live data stays fresh.
//
// UPDATES: bump CACHE on every deploy (e.g. v2 -> v3). Changing this string makes
// the file byte-different, so the browser re-installs this worker, we skipWaiting
// + claim immediately, and the page (which listens for 'controllerchange') reloads
// once to pick up the new build — no more repeated hard refreshes.
const CACHE = 'ms-shell-v3';
const SHELL = ['/'];

// Let the page tell a waiting worker to activate now.
self.addEventListener('message', (e) => { if (e.data === 'SKIP_WAITING') self.skipWaiting(); });

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // leave fonts / archive.org / APIs alone

  const isShell = req.mode === 'navigate';
  const isStatic = url.pathname.startsWith('/_next/static') || url.pathname.startsWith('/icons');

  e.respondWith(
    fetch(req)
      .then((res) => {
        if (res && res.ok && (isShell || isStatic)) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
        }
        return res;
      })
      .catch(() =>
        caches.match(req).then((cached) => cached || (isShell ? caches.match('/') : Response.error()))
      )
  );
});

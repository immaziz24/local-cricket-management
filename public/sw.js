/* #26 Offline support: keep the website's own files so the scoring page still opens without internet.
 * Network first (always fresh when online); the cached copy is used only when the network fails.
 * Requests to the database (other sites) are not cached – the scoring screen keeps its own offline copy. */
const CACHE = 'local-cricket-v2';
const OFFLINE = '/offline.html';

// #394 keep a friendly page ready for a first visit that happens with no internet
self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.add(OFFLINE)).catch(() => {}).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req.mode === 'navigate' ? '/' : req, copy));
        }
        return res;
      })
      .catch(() => caches.match(req.mode === 'navigate' ? '/' : req).then((hit) => hit || (req.mode === 'navigate' ? caches.match(OFFLINE) : undefined) || caches.match('/')))
  );
});

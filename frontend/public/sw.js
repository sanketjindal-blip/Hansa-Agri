/* HANSA PWA service worker — minimal app-shell offline cache.
 *
 * Strategy:
 *   - Pre-cache the app shell on install (HTML + bundle).
 *   - On fetch for app-shell assets: cache-first with network fallback.
 *   - On fetch for /api/*: network-only (so the app fails gracefully offline
 *     instead of serving stale data, and we never accidentally cache auth /
 *     OTP / live order responses).
 *   - On fetch for any other GET: stale-while-revalidate (covers images, fonts).
 *   - Bump SW_VERSION to invalidate old caches on the next page load.
 */
const SW_VERSION = 'hansa-pwa-v1';
const SHELL_CACHE = `${SW_VERSION}-shell`;
const RUNTIME_CACHE = `${SW_VERSION}-runtime`;
const SHELL = ['/'];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(SHELL_CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys.filter((k) => !k.startsWith(SW_VERSION)).map((k) => caches.delete(k))
    );
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Never intercept API calls — let them hit the network so auth/data is fresh.
  if (url.pathname.startsWith('/api/')) return;
  // Don't intercept dev/HMR endpoints.
  if (url.pathname.includes('/__expo') || url.pathname.includes('/_expo')) return;
  if (url.protocol === 'chrome-extension:') return;

  // Navigation requests → network first, fall back to cached shell when offline.
  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(req);
        const cache = await caches.open(SHELL_CACHE);
        cache.put('/', fresh.clone());
        return fresh;
      } catch {
        const cached = await caches.match('/');
        if (cached) return cached;
        return new Response('Offline', { status: 503, statusText: 'offline' });
      }
    })());
    return;
  }

  // Static assets (JS bundle, CSS, images, fonts) → stale-while-revalidate.
  event.respondWith((async () => {
    const cached = await caches.match(req);
    const fetchPromise = fetch(req)
      .then((resp) => {
        if (resp && resp.status === 200 && resp.type === 'basic') {
          caches.open(RUNTIME_CACHE).then((c) => c.put(req, resp.clone()));
        }
        return resp;
      })
      .catch(() => cached);
    return cached || fetchPromise;
  })());
});

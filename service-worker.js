/**
 * service-worker.js
 * Offline support for the installed PWA (spec section 8.1).
 *
 * Strategy: cache-first for everything, with a network fallback that
 * opportunistically caches whatever it fetches. This keeps the whole
 * app shell (HTML/CSS/JS/icons + the CDN libraries it depends on)
 * available offline after the first successful load, with no build
 * step and no framework -- just the Cache Storage API.
 *
 * Bump CACHE_VERSION whenever app-shell files change; the `activate`
 * handler deletes any cache that doesn't match the current version, so
 * stale versions never accumulate.
 */

const CACHE_VERSION = 'tvleveler-v1';

// Same-origin app shell. Paths are relative so this works unmodified
// whether the app is served from a domain root or a GitHub Pages
// project subpath (e.g. /tv-leveler/).
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './ReadMe.md',
  './css/style.css',
  './js/main.js',
  './js/uiController.js',
  './js/orientationMath.js',
  './js/quaternionMath.js',
  './js/sensors.js',
  './js/theme.js',
  './js/qrCode.js',
  './js/helpPage.js',
  './js/pwa.js',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
  './favicon.ico',
];

// Third-party CDN resources the app depends on. Most CDNs of this kind
// serve permissive CORS headers, so these can be cached as normal
// (non-opaque) responses; see the fetch handler for the opaque-response
// fallback in case a given resource doesn't.
const CDN_SHELL = [
  'https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css',
  'https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js',
  'https://cdn.jsdelivr.net/npm/marked@12.0.2/marked.min.js',
  'https://cdn.jsdelivr.net/npm/qrcode-generator@2.0.4/qrcode.js',
  'https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;700&family=Inter:wght@400;500;600&display=swap',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then(async (cache) => {
      // Precache resources individually (not cache.addAll) so a single
      // failing/blocked request -- a flaky CDN, an ad-blocker -- can't
      // abort the whole install and leave the app shell uncached.
      await Promise.allSettled(
        [...APP_SHELL, ...CDN_SHELL].map((url) => cache.add(url).catch(() => {})),
      );
    }).then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((key) => key !== CACHE_VERSION).map((key) => caches.delete(key)),
      ))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;

      return fetch(event.request)
        .then((response) => {
          // response.type === 'opaque' covers cross-origin requests
          // that didn't get CORS headers -- still cacheable, just not
          // inspectable, which is fine for offline replay.
          if (response && (response.ok || response.type === 'opaque')) {
            const copy = response.clone();
            caches.open(CACHE_VERSION).then((cache) => cache.put(event.request, copy));
          }
          return response;
        })
        .catch(() => cached);
    }),
  );
});

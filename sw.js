// ═══════════════════════════════════════════════════════
// ARKIV — Service Worker v1.0
// Cache-first pentru shell, network-fallback pentru resto
// ═══════════════════════════════════════════════════════

const CACHE_NAME = 'arkiv-shell-v1';

// Fișierele care constituie shell-ul aplicației
const SHELL_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  // Fonturile Google — le cache-uim la primul acces
];

// ── INSTALL ─────────────────────────────────────────────
// Precache shell-ul imediat la instalare
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(SHELL_ASSETS);
    }).then(() => {
      // Activează imediat, fără să aștepte reload
      return self.skipWaiting();
    })
  );
});

// ── ACTIVATE ────────────────────────────────────────────
// Șterge cache-urile vechi la activare
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

// ── FETCH ───────────────────────────────────────────────
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Ignoră request-urile non-GET
  if (request.method !== 'GET') return;

  // Ignoră extensii browser și chrome-extension
  if (url.protocol === 'chrome-extension:') return;

  // Strategia pentru fonturi Google — cache then network
  if (url.hostname === 'fonts.googleapis.com' ||
      url.hostname === 'fonts.gstatic.com') {
    event.respondWith(cacheFirst(request, 'arkiv-fonts-v1'));
    return;
  }

  // Strategia pentru shell-ul propriu — cache first
  if (url.origin === self.location.origin) {
    event.respondWith(cacheFirst(request, CACHE_NAME));
    return;
  }

  // Tot restul — network cu fallback la cache
  event.respondWith(networkFirst(request));
});

// ── STRATEGII ───────────────────────────────────────────

// Cache-first: servim din cache, dacă nu e mergem la rețea și salvăm
async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    // Offline și nu e în cache — returnăm index.html ca fallback
    const fallback = await cache.match('./index.html');
    return fallback || new Response('Offline — resursa nu este disponibilă.', {
      status: 503,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' }
    });
  }
}

// Network-first: încercăm rețeaua, fallback la cache
async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    return cached || new Response('Offline.', { status: 503 });
  }
}

// ── MESAJE DE LA CLIENT ─────────────────────────────────
self.addEventListener('message', event => {
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

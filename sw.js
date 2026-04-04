// Wiki Personal — Service Worker
// Versiune: 20260405
// Pune acest fișier în ACELAȘI folder cu wikitano1.html pe GitHub Pages

const CACHE = 'wiki-v20260405';

// Fișierele care trebuie să fie disponibile offline
// Ajustează calea dacă fișierul tău HTML are alt nume
const ASSETS = [
  './',
  './wikitano1.html',
  'https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400;0,600;1,400&family=JetBrains+Mono:wght@400;600&display=swap'
];

// Instalare: pune toate resursele în cache
self.addEventListener('install', function(e) {
  e.waitUntil(
    caches.open(CACHE).then(function(c) {
      // Adaugă fiecare asset separat — dacă unul eșuează, restul continuă
      return Promise.all(
        ASSETS.map(function(url) {
          return c.add(url).catch(function() {
            // Fonturile Google pot eșua offline — ignoră
          });
        })
      );
    }).then(function() {
      return self.skipWaiting();
    })
  );
});

// Activare: șterge cache-urile vechi
self.addEventListener('activate', function(e) {
  e.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys.filter(function(k) { return k !== CACHE; })
            .map(function(k) { return caches.delete(k); })
      );
    }).then(function() {
      return self.clients.claim();
    })
  );
});

// Fetch: cache-first cu actualizare în fundal (stale-while-revalidate)
self.addEventListener('fetch', function(e) {
  if (e.request.method !== 'GET') return;
  if (!e.request.url.startsWith('http')) return;

  e.respondWith(
    caches.match(e.request).then(function(cached) {
      // Actualizează în fundal
      var fetchPromise = fetch(e.request).then(function(resp) {
        if (resp && resp.status === 200 && resp.type !== 'opaque') {
          var clone = resp.clone();
          caches.open(CACHE).then(function(c) { c.put(e.request, clone); });
        }
        return resp;
      }).catch(function() { return null; });

      // Răspunde imediat din cache dacă există, altfel așteaptă rețeaua
      return cached || fetchPromise || new Response('Offline — deschide aplicația când ai internet pentru a actualiza cache-ul.', {
        status: 503,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' }
      });
    })
  );
});

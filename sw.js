// Wiki Personal — Service Worker v20260406

const CACHE = 'wiki-v20260406';

self.addEventListener('install', function(e) {
  e.waitUntil(
    caches.open(CACHE).then(function(c) {
      return c.add('./wikitano.html').catch(function() {
        return c.add('./');
      });
    }).then(function() { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function(e) {
  e.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(keys.filter(function(k){return k!==CACHE;}).map(function(k){return caches.delete(k);}));
    }).then(function() { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function(e) {
  if (e.request.method !== 'GET') return;
  if (!e.request.url.startsWith('http')) return;
  var url = new URL(e.request.url);
  // Doar fisiere locale — ignora resurse externe
  if (url.origin !== self.location.origin) return;

  e.respondWith(
    caches.match(e.request).then(function(cached) {
      // Actualizeaza in fundal
      var fetchPromise = fetch(e.request).then(function(resp) {
        if (resp && resp.status === 200) {
          var clone = resp.clone();
          caches.open(CACHE).then(function(c) { c.put(e.request, clone); });
        }
        return resp;
      }).catch(function() { return null; });

      // Cache-first: daca e in cache raspunde imediat
      return cached || fetchPromise || new Response('Offline.', {status:503});
    })
  );
});

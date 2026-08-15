// Wiki Personal — Service Worker v20260815n
//
// Aplicatia sta in /Wiki/, deci acest service worker are teritoriul /Wiki/ si
// nu atinge paginile din /LogOS/. DAR cache-urile sunt comune pe tot domeniul
// tanovasea.github.io, nu pe folder — de aceea stergem doar ce e al nostru
// (prefixul 'wiki-'). Varianta veche stergea tot, inclusiv cache-ul LogOS.

const CACHE = 'wiki-v20260815n';

// Paginile servite de pe acest domeniu
const PRECACHE = ['./', './wikitano.html', './index.html'];

self.addEventListener('install', function(e) {
  e.waitUntil(
    caches.open(CACHE).then(function(c) {
      return Promise.all(PRECACHE.map(function(u) {
        // cache:'reload' = ia fisierul de la server, nu din cache-ul browserului
        return c.add(new Request(u, { cache: 'reload' })).catch(function() { return null; });
      }));
    }).then(function() { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function(e) {
  e.waitUntil(
    caches.keys().then(function(keys) {
      // Doar cache-urile noastre. Alte aplicatii de pe acelasi domeniu isi
      // pastreaza ale lor — stergerea le-ar scoate din functionare offline.
      return Promise.all(keys.filter(function(k) {
        return k.indexOf('wiki-') === 0 && k !== CACHE;
      }).map(function(k) { return caches.delete(k); }));
    }).then(function() { return self.clients.claim(); })
  );
});

// Cautare toleranta: ignoreVary evita ratarile cand serverul trimite antetul
// Vary, ignoreSearch acopera adresele cu ?parametri.
function fromCache(req) {
  return caches.match(req, { ignoreVary: true }).then(function(r) {
    return r || caches.match(req, { ignoreVary: true, ignoreSearch: true });
  });
}

// Rezerva la navigare — strict pentru adresa ceruta din folderul nostru.
function offlineFallback(url) {
  var path = url.pathname, candidates = [];
  if (/wikitano\.html$/.test(path)) candidates.push('./wikitano.html');
  else if (/\/$/.test(path) || /index\.html$/.test(path)) candidates.push('./index.html', './');
  else candidates.push(path);

  return caches.open(CACHE).then(function(c) {
    return candidates.reduce(function(chain, u) {
      return chain.then(function(found) {
        return found || c.match(u, { ignoreVary: true, ignoreSearch: true });
      });
    }, Promise.resolve(null));
  }).then(function(r) {
    return r || new Response(
      '<!DOCTYPE html><meta charset="utf-8"><body style="font:16px Georgia,serif;padding:40px">' +
      'Pagina nu a fost salvată local încă. Deschide-o o dată cu internet pornit.</body>',
      { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    );
  });
}

self.addEventListener('fetch', function(e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  if (!req.url.startsWith('http')) return;
  var url = new URL(req.url);

  // Resursele externe raman in seama browserului
  if (url.origin !== self.location.origin) return;

  e.respondWith(
    fromCache(req).then(function(cached) {
      var network = fetch(req).then(function(resp) {
        // raspunsurile redirectionate nu se pun in cache: nu pot fi refolosite la navigare
        if (resp && resp.status === 200 && !resp.redirected) {
          var clone = resp.clone();
          caches.open(CACHE).then(function(c) { c.put(req, clone); });
        }
        return resp;
      }).catch(function() { return null; });

      // Avem copie locala: raspundem imediat si actualizam in fundal
      if (cached) {
        e.waitUntil(network);
        return cached;
      }

      // Fara copie locala: incercam reteaua
      return network.then(function(resp) {
        if (resp) return resp;
        if (req.mode === 'navigate') return offlineFallback(url);
        return new Response('', { status: 504 });
      });
    })
  );
});
